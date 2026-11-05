// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StreetPayCheckout} from "../src/StreetPayCheckout.sol";

/// Minimal Foundry cheatcode interface, so the tests need no forge-std submodule.
interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function expectRevert(bytes4) external;
    function expectEmit(bool, bool, bool, bool) external;
}

/// Behaves like Tether's USDT: transferFrom returns nothing, reverts on failure.
contract NoReturnUSDT {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external { allowance[msg.sender][s] = a; }

    function transferFrom(address f, address t, uint256 a) external {
        require(allowance[f][msg.sender] >= a, "allowance");
        require(balanceOf[f] >= a, "balance");
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[t] += a;
    }
}

/// Returns false instead of reverting, to prove the contract checks the bool.
contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
}

contract StreetPayCheckoutTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Paid(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount);

    uint256 constant SIGNER_PK = 0xA11CE;
    uint256 constant OTHER_PK = 0xB0B;
    address signer;
    address customer = address(0xC0DE);
    address stall = address(0x5AB21);
    NoReturnUSDT usdt;
    StreetPayCheckout pay;

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        usdt = new NoReturnUSDT();
        pay = new StreetPayCheckout(address(usdt), signer);
        usdt.mint(customer, 100e6);
        usdt.mint(stall, 50e6);
        vm.prank(customer);
        usdt.approve(address(pay), type(uint256).max);
        vm.prank(stall);
        usdt.approve(address(pay), type(uint256).max);
        vm.warp(1_800_000_000);
    }

    // ------------------------------------------------------------ helpers

    function intent(bytes32 ref, uint256 amount) internal view returns (StreetPayCheckout.Intent memory) {
        return StreetPayCheckout.Intent(ref, customer, stall, amount, block.timestamp + 15 minutes);
    }

    function signWith(uint256 pk, StreetPayCheckout.Intent memory it) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pay.hashIntent(it));
        return abi.encodePacked(r, s, v);
    }

    function eq(uint256 a, uint256 b, string memory m) internal pure { require(a == b, m); }

    // ------------------------------------------------------------ pay

    function test_pay_moves_usdt_to_stall_and_records_it() public {
        StreetPayCheckout.Intent memory it = intent("o1024", 1.07e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.expectEmit(true, true, true, true);
        emit Paid("o1024", customer, stall, 1.07e6);
        vm.prank(customer);
        pay.pay(it, sig);

        eq(usdt.balanceOf(customer), 100e6 - 1.07e6, "customer debited");
        eq(usdt.balanceOf(stall), 50e6 + 1.07e6, "stall credited");
        eq(usdt.balanceOf(address(pay)), 0, "contract holds nothing");
        require(pay.isPaid("o1024"), "marked paid");
        (address p, address m, uint128 amt,, uint64 at) = pay.payments("o1024");
        require(p == customer && m == stall && amt == 1.07e6 && at == block.timestamp, "record");
    }

    function test_same_order_cannot_be_paid_twice() public {
        StreetPayCheckout.Intent memory it = intent("o1", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.prank(customer);
        pay.pay(it, sig);
        vm.expectRevert(StreetPayCheckout.AlreadyPaid.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_expired_intent_rejected() public {
        StreetPayCheckout.Intent memory it = intent("o2", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.warp(it.expiresAt + 1);
        vm.expectRevert(StreetPayCheckout.Expired.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_only_the_named_payer_can_pay() public {
        StreetPayCheckout.Intent memory it = intent("o3", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.expectRevert(StreetPayCheckout.NotPayer.selector);
        vm.prank(address(0xBAD));
        pay.pay(it, sig);
    }

    function test_unsigned_or_wrongly_signed_intent_rejected() public {
        StreetPayCheckout.Intent memory it = intent("o4", 1e6);
        bytes memory sig = signWith(OTHER_PK, it);
        vm.expectRevert(StreetPayCheckout.BadSignature.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_tampered_amount_or_merchant_rejected() public {
        StreetPayCheckout.Intent memory it = intent("o5", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        it.amount = 1; // pay less than priced
        vm.expectRevert(StreetPayCheckout.BadSignature.selector);
        vm.prank(customer);
        pay.pay(it, sig);

        it.amount = 1e6;
        it.merchant = address(0xBAD); // redirect money
        vm.expectRevert(StreetPayCheckout.BadSignature.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_malleable_high_s_signature_rejected() public {
        StreetPayCheckout.Intent memory it = intent("o6", 1e6);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, pay.hashIntent(it));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory flipped = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(StreetPayCheckout.BadSignature.selector);
        vm.prank(customer);
        pay.pay(it, flipped);
    }

    function test_zero_amount_and_self_pay_rejected() public {
        StreetPayCheckout.Intent memory it = intent("o7", 0);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.expectRevert(StreetPayCheckout.BadAmount.selector);
        vm.prank(customer);
        pay.pay(it, sig);

        it = intent("o8", 1e6);
        it.merchant = customer;
        sig = signWith(SIGNER_PK, it);
        vm.expectRevert(StreetPayCheckout.BadAddress.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_paused_blocks_new_payments() public {
        pay.setPaused(true);
        StreetPayCheckout.Intent memory it = intent("o9", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.expectRevert(StreetPayCheckout.IsPaused.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_token_returning_false_is_caught() public {
        FalseToken bad = new FalseToken();
        StreetPayCheckout p2 = new StreetPayCheckout(address(bad), signer);
        StreetPayCheckout.Intent memory it = intent("o10", 1e6);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, p2.hashIntent(it));
        vm.expectRevert(StreetPayCheckout.TransferFailed.selector);
        vm.prank(customer);
        p2.pay(it, abi.encodePacked(r, s, v));
    }

    // ------------------------------------------------------------ refund

    function paid(bytes32 ref, uint256 amount) internal {
        StreetPayCheckout.Intent memory it = intent(ref, amount);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_stall_refunds_in_parts_up_to_the_paid_amount() public {
        paid("r1", 2e6);
        vm.prank(stall);
        pay.refund("r1", 0.5e6);
        vm.prank(stall);
        pay.refund("r1", 1.5e6);
        eq(usdt.balanceOf(customer), 100e6, "customer whole again");
        (,,, uint128 refunded,) = pay.payments("r1");
        eq(refunded, 2e6, "refunded total");

        vm.expectRevert(StreetPayCheckout.RefundTooLarge.selector);
        vm.prank(stall);
        pay.refund("r1", 1);
    }

    function test_only_the_stall_can_refund() public {
        paid("r2", 1e6);
        vm.expectRevert(StreetPayCheckout.NotMerchant.selector);
        vm.prank(customer);
        pay.refund("r2", 1e6);
    }

    function test_refund_unknown_order_rejected() public {
        vm.expectRevert(StreetPayCheckout.UnknownOrder.selector);
        vm.prank(stall);
        pay.refund("nope", 1);
    }

    function test_refunds_still_work_while_paused() public {
        paid("r3", 1e6);
        pay.setPaused(true);
        vm.prank(stall);
        pay.refund("r3", 1e6);
    }

    // ------------------------------------------------------------ admin

    function test_only_owner_rotates_signer_and_pauses() public {
        vm.expectRevert(StreetPayCheckout.NotOwner.selector);
        vm.prank(customer);
        pay.setSigner(customer);

        vm.expectRevert(StreetPayCheckout.NotOwner.selector);
        vm.prank(customer);
        pay.setPaused(true);

        address next = vm.addr(OTHER_PK);
        pay.setSigner(next);
        require(pay.signer() == next, "rotated");
        // old signer's intents stop working at once
        StreetPayCheckout.Intent memory it = intent("a1", 1e6);
        bytes memory sig = signWith(SIGNER_PK, it);
        vm.expectRevert(StreetPayCheckout.BadSignature.selector);
        vm.prank(customer);
        pay.pay(it, sig);
    }

    function test_constructor_rejects_non_contract_token() public {
        vm.expectRevert(StreetPayCheckout.BadAddress.selector);
        new StreetPayCheckout(address(0x1234), signer);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_refund_never_exceeds_paid(uint96 amount, uint96 a, uint96 b) public {
        amount = uint96(1 + (uint256(amount) % 50e6));
        usdt.mint(customer, amount);
        paid("fz", amount);
        usdt.mint(stall, uint256(a) + uint256(b));
        a = uint96(uint256(a) % (uint256(amount) + 1));
        if (a > 0) { vm.prank(stall); pay.refund("fz", a); }
        uint256 left = amount - a;
        if (b > 0 && b <= left) { vm.prank(stall); pay.refund("fz", b); }
        (,, uint128 paidAmt, uint128 refunded,) = pay.payments("fz");
        require(refunded <= paidAmt, "refund cap");
    }
}
