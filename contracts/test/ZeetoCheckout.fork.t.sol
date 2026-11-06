// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZeetoCheckout} from "../src/ZeetoCheckout.sol";

interface Vm {
    function prank(address) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function envOr(string calldata, bool) external returns (bool);
}

interface IUSDT {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external;
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// Runs against the REAL Whitechain test USDT on a fork of chain 1874:
///   forge test --match-contract ZeetoCheckoutForkTest --fork-url https://rpc.testnet.whitechain.io
/// Proves the live token accepts the exact signatures the app produces (domain "Tether USD"/"1", ReceiveWithAuthorization).
contract ZeetoCheckoutForkTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    IUSDT constant USDT = IUSDT(0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7);
    address constant WHALE = 0xA1616Fe9624B64eF2Dddc8ccAc735bAA234CEbF7; // a large test-USDT holder, used only on the fork
    bytes32 constant RECEIVE_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    function _sig(uint256 pk, address from, address to, uint256 v, uint256 before, bytes32 nonce) internal returns (bytes memory) {
        bytes32 d = keccak256(abi.encodePacked("\x19\x01", USDT.DOMAIN_SEPARATOR(), keccak256(abi.encode(RECEIVE_TYPEHASH, from, to, v, 0, before, nonce))));
        (uint8 a, bytes32 r, bytes32 s) = vm.sign(pk, d);
        return abi.encodePacked(r, s, a);
    }

    function test_fork_real_usdt_pay_and_refund() public {
        if (block.chainid != 1874) return; // only meaningful on the fork
        ZeetoCheckout co = new ZeetoCheckout(address(USDT));
        uint256 cpk = 0xC0FFEE;
        uint256 spk = 0x5EA11;
        address customer = vm.addr(cpk);
        address stall = vm.addr(spk);
        vm.prank(WHALE);
        USDT.transfer(customer, 5e6);

        bytes32 ref = keccak256("fork-order");
        uint256 before = block.timestamp + 600;
        bytes memory sig = _sig(cpk, customer, address(co), 2_500_000, before, co.payNonce(ref, stall));
        co.pay(ref, customer, stall, 2_500_000, 0, before, sig);
        require(USDT.balanceOf(stall) == 2_500_000, "stall paid with real USDT");
        require(USDT.balanceOf(customer) == 2_500_000, "customer debited");

        bytes memory r = _sig(spk, stall, address(co), 1_000_000, before, co.refundNonce(ref, 0, 1_000_000));
        co.refund(ref, customer, 1_000_000, 0, before, r);
        require(USDT.balanceOf(customer) == 3_500_000, "refund reached customer");
        require(USDT.balanceOf(address(co)) == 0, "no funds kept");
    }
}
