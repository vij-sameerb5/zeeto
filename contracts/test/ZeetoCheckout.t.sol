// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZeetoCheckout} from "../src/ZeetoCheckout.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool) external;
    function chainId(uint256) external;
}

/// Mirrors Whitechain's test USDT where it matters: EIP-712 domain ("Tether USD", "1"), EIP-3009
/// receiveWithAuthorization (caller must be the payee, nonce single-use, time window), and transfer with no return value.
contract MockUSDT3009 {
    string public constant name = "Tether USD";
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)), keccak256("1"), block.chainid, address(this)
        ));
    }

    function mint(address to, uint256 a) external { balanceOf[to] += a; }

    function transfer(address to, uint256 a) external {
        require(balanceOf[msg.sender] >= a, "balance");
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
    }

    function receiveWithAuthorization(
        address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s
    ) external {
        require(to == msg.sender, "caller must be the payee");
        require(block.timestamp > validAfter, "not yet valid");
        require(block.timestamp < validBefore, "expired");
        require(!authorizationState[from][nonce], "authorization used");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode(RECEIVE_TYPEHASH, from, to, value, validAfter, validBefore, nonce))));
        require(ecrecover(digest, v, r, s) == from, "invalid signature");
        authorizationState[from][nonce] = true;
        require(balanceOf[from] >= value, "balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }
}

contract ZeetoCheckoutTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDT3009 usdt;
    ZeetoCheckout co;

    uint256 constant CUSTOMER_PK = 0xA11CE;
    uint256 constant STALL_PK = 0xB0B;
    uint256 constant ATTACKER_PK = 0xBAD;
    address customer;
    address stall;
    address attacker;
    address relayer = address(0xFEE);
    bytes32 constant REF = keccak256("zeeto:o123:ravi:1874");
    uint256 constant AMT = 1_430_000; // 1.43 USDT

    event Paid(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount, address relayer);
    event Refunded(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount, uint256 totalRefunded);

    function setUp() public {
        vm.chainId(1874);
        vm.warp(1_800_000_000);
        usdt = new MockUSDT3009();
        co = new ZeetoCheckout(address(usdt));
        customer = vm.addr(CUSTOMER_PK);
        stall = vm.addr(STALL_PK);
        attacker = vm.addr(ATTACKER_PK);
        usdt.mint(customer, 100e6);
        usdt.mint(attacker, 100e6);
        usdt.mint(stall, 10e6);
    }

    // ---------------------------------------------------------------- helpers

    function _sig(uint256 pk, address from, uint256 value, bytes32 nonce, uint256 before) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdt.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(usdt.RECEIVE_TYPEHASH(), from, address(co), value, 0, before, nonce))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _paySig(bytes32 ref, address merchant, uint256 amt) internal returns (bytes memory) {
        return _sig(CUSTOMER_PK, customer, amt, co.payNonce(ref, merchant), block.timestamp + 600);
    }

    function _pay() internal {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.prank(relayer);
        co.pay(REF, customer, stall, AMT, 0, block.timestamp + 600, sig);
    }

    function _refundSig(uint256 done, uint256 amt) internal returns (bytes memory) {
        return _sig(STALL_PK, stall, amt, co.refundNonce(REF, done, amt), block.timestamp + 600);
    }

    function _eq(uint256 a, uint256 b, string memory m) internal pure { require(a == b, m); }

    // ---------------------------------------------------------------- pay

    function test_pay_movesExactAmountToStall_relayerPaysGas_noFundsKept() public {
        uint256 s0 = usdt.balanceOf(stall);
        vm.expectEmit(true, true, true, true);
        emit Paid(REF, customer, stall, AMT, relayer);
        _pay();
        _eq(usdt.balanceOf(customer), 100e6 - AMT, "customer debited");
        _eq(usdt.balanceOf(stall), s0 + AMT, "stall credited");
        _eq(usdt.balanceOf(address(co)), 0, "contract holds nothing");
        ZeetoCheckout.Payment memory p = co.getPayment(REF, customer);
        require(p.payer == customer && p.merchant == stall && p.amount == AMT && p.refunded == 0, "recorded");
    }

    function test_pay_twice_reverts() public {
        _pay();
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.expectRevert(ZeetoCheckout.AlreadyPaid.selector);
        co.pay(REF, customer, stall, AMT, 0, block.timestamp + 600, sig);
    }

    function test_relayer_cannot_redirect_to_another_wallet() public {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.expectRevert(bytes("invalid signature"));
        co.pay(REF, customer, attacker, AMT, 0, block.timestamp + 600, sig);
    }

    function test_relayer_cannot_change_amount() public {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.expectRevert(bytes("invalid signature"));
        co.pay(REF, customer, stall, AMT * 2, 0, block.timestamp + 600, sig);
    }

    function test_signature_cannot_pay_a_different_order() public {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.expectRevert(bytes("invalid signature"));
        co.pay(keccak256("other order"), customer, stall, AMT, 0, block.timestamp + 600, sig);
    }

    function test_expired_signature_reverts() public {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.warp(block.timestamp + 601);
        vm.expectRevert(bytes("expired"));
        co.pay(REF, customer, stall, AMT, 0, block.timestamp - 1, sig);
    }

    function test_frontrunning_with_own_money_cannot_block_the_real_customer() public {
        // Attacker sees REF and pays it first, to themselves.
        bytes memory a = _sig(ATTACKER_PK, attacker, 1, co.payNonce(REF, attacker == stall ? stall : address(0xBEEF)), block.timestamp + 600);
        co.pay(REF, attacker, address(0xBEEF), 1, 0, block.timestamp + 600, a);
        // The real customer still pays their own order.
        _pay();
        require(co.getPayment(REF, customer).merchant == stall, "customer's payment recorded");
    }

    function test_bad_inputs_revert() public {
        bytes memory sig = _paySig(REF, stall, AMT);
        vm.expectRevert(ZeetoCheckout.BadAddress.selector);
        co.pay(REF, customer, customer, AMT, 0, block.timestamp + 600, sig);
        vm.expectRevert(ZeetoCheckout.BadAmount.selector);
        co.pay(REF, customer, stall, 0, 0, block.timestamp + 600, sig);
        vm.expectRevert(ZeetoCheckout.BadSignature.selector);
        co.pay(REF, customer, stall, AMT, 0, block.timestamp + 600, hex"1234");
    }

    // ---------------------------------------------------------------- refund

    function test_partial_then_full_refund_back_to_payer_only() public {
        _pay();
        uint256 c0 = usdt.balanceOf(customer);
        bytes memory r1 = _refundSig(0, 430_000);
        vm.expectEmit(true, true, true, true);
        emit Refunded(REF, customer, stall, 430_000, 430_000);
        vm.prank(relayer);
        co.refund(REF, customer, 430_000, 0, block.timestamp + 600, r1);
        _eq(usdt.balanceOf(customer), c0 + 430_000, "partial back");

        bytes memory r2 = _refundSig(430_000, 1_000_000);
        co.refund(REF, customer, 1_000_000, 0, block.timestamp + 600, r2);
        _eq(usdt.balanceOf(customer), c0 + AMT, "full back");
        _eq(co.getPayment(REF, customer).refunded, AMT, "refunded total");
        _eq(usdt.balanceOf(address(co)), 0, "contract holds nothing");
    }

    function test_refund_cannot_exceed_payment() public {
        _pay();
        bytes memory r = _refundSig(0, AMT + 1);
        vm.expectRevert(ZeetoCheckout.RefundTooLarge.selector);
        co.refund(REF, customer, AMT + 1, 0, block.timestamp + 600, r);
    }

    function test_refund_signature_cannot_be_replayed() public {
        _pay();
        bytes memory r = _refundSig(0, 100_000);
        co.refund(REF, customer, 100_000, 0, block.timestamp + 600, r);
        // Same signature again: the nonce now includes refundedSoFar = 100000, so it no longer matches.
        vm.expectRevert(bytes("invalid signature"));
        co.refund(REF, customer, 100_000, 0, block.timestamp + 600, r);
    }

    function test_only_the_stall_can_sign_a_refund() public {
        _pay();
        bytes memory r = _sig(ATTACKER_PK, attacker, 100_000, co.refundNonce(REF, 0, 100_000), block.timestamp + 600);
        vm.expectRevert(bytes("invalid signature"));
        co.refund(REF, customer, 100_000, 0, block.timestamp + 600, r);
    }

    function test_refund_unknown_order_reverts() public {
        bytes memory r = _refundSig(0, 1);
        vm.expectRevert(ZeetoCheckout.UnknownOrder.selector);
        co.refund(REF, customer, 1, 0, block.timestamp + 600, r);
    }

    // ---------------------------------------------------------------- admin

    function test_pause_blocks_payments_but_never_refunds() public {
        _pay();
        co.setPaused(true);
        bytes memory sig = _sig(CUSTOMER_PK, customer, 1, co.payNonce(keccak256("x"), stall), block.timestamp + 600);
        vm.expectRevert(ZeetoCheckout.IsPaused.selector);
        co.pay(keccak256("x"), customer, stall, 1, 0, block.timestamp + 600, sig);
        bytes memory r = _refundSig(0, AMT);
        co.refund(REF, customer, AMT, 0, block.timestamp + 600, r);
    }

    function test_only_owner_can_pause_and_ownership_is_two_step() public {
        vm.prank(attacker);
        vm.expectRevert(ZeetoCheckout.NotOwner.selector);
        co.setPaused(true);
        co.transferOwnership(attacker);
        require(co.owner() == address(this), "not yet");
        vm.prank(attacker);
        co.acceptOwnership();
        require(co.owner() == attacker, "moved");
    }
}
