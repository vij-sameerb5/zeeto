// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev The EIP-3009 functions of Whitechain's test USDT (0xcedfB561...f55a7), checked onchain:
///      receiveWithAuthorization(v,r,s) selector 0xef55bec6 and authorizationState are present.
interface IUSDT3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title ZeetoCheckout
/// @notice Gasless USDT checkout for street stalls and small shops on Whitechain.
///
/// The customer never sends a transaction and never needs WBT:
///  1. They sign an EIP-3009 `ReceiveWithAuthorization` (an off-chain signature, no gas) that lets THIS contract pull
///     `amount` USDT from them once. The authorization's nonce is `payNonce(orderRef, merchant)`, so the stall that
///     gets paid is part of what they signed: a relayer can't redirect the money or reuse the signature for another order.
///  2. Anyone (Zeeto's relayer, which pays the WBT gas for the business) submits it with `pay`. The contract pulls the
///     USDT and forwards it to the stall in the same transaction. It never keeps funds.
///  3. The order is recorded onchain: one payment per order reference, refunds capped at what was paid, and every step
///     emits an event the stall's systems (webhooks) and the customer (receipt link) can check.
///
/// Refunds are gasless too: the stall signs a `ReceiveWithAuthorization` from its wallet with nonce
/// `refundNonce(orderRef, refundedSoFar, amount)`; the contract sends the money to the wallet that paid, never anywhere else.
///
/// `receiveWithAuthorization` (not `transferWithAuthorization`) is used on purpose: it only works when the caller is the
/// payee (this contract), so a signature seen in the mempool can't be front-run into a plain transfer.
contract ZeetoCheckout {
    // ---------------------------------------------------------------- state

    struct Payment {
        address payer;
        address merchant;
        uint128 amount;
        uint128 refunded;
        uint64 paidAt;
    }

    IUSDT3009 public immutable usdt;
    address public owner;
    address public pendingOwner;
    bool public paused;
    mapping(bytes32 => Payment) public payments;

    uint256 private _lock = 1;

    // ---------------------------------------------------------------- events & errors

    /// @param relayer who paid the gas (shows the business, not the customer, covered it)
    event Paid(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount, address relayer);
    event Refunded(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount, uint256 totalRefunded);
    event Paused(bool paused);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error IsPaused();
    error AlreadyPaid();
    error UnknownOrder();
    error BadAddress();
    error BadAmount();
    error BadSignature();
    error RefundTooLarge();
    error TransferFailed();
    error Reentrancy();
    error NotOwner();

    // ---------------------------------------------------------------- setup

    constructor(address usdt_) {
        if (usdt_.code.length == 0) revert BadAddress();
        usdt = IUSDT3009(usdt_);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------- pay

    /// @notice Settle one order with the customer's signed authorization. Callable by anyone; only the signed result can happen.
    /// @param orderRef the order's reference (made by the Zeeto API, unique per order)
    /// @param payer the customer's wallet (the signer)
    /// @param merchant the stall's wallet; bound into the signature through the nonce
    /// @param amount USDT base units (6 decimals)
    function pay(
        bytes32 orderRef,
        address payer,
        address merchant,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes calldata signature
    ) external nonReentrant {
        if (paused) revert IsPaused();
        if (payer == address(0) || merchant == address(0) || merchant == payer || merchant == address(this)) revert BadAddress();
        if (amount == 0 || amount > type(uint128).max) revert BadAmount();
        bytes32 key = paymentKey(orderRef, payer);
        if (payments[key].payer != address(0)) revert AlreadyPaid();

        // Effects first.
        payments[key] = Payment({payer: payer, merchant: merchant, amount: uint128(amount), refunded: 0, paidAt: uint64(block.timestamp)});

        // Pull exactly what the customer signed (reverts on a bad/used/expired signature), then forward it all to the stall.
        _pull(payer, amount, validAfter, validBefore, payNonce(orderRef, merchant), signature);
        _send(merchant, amount);

        emit Paid(orderRef, payer, merchant, amount, msg.sender);
    }

    // ---------------------------------------------------------------- refund

    /// @notice Refund part or all of a paid order, signed by the stall. Money only ever goes back to the original payer.
    function refund(bytes32 orderRef, address payer, uint256 amount, uint256 validAfter, uint256 validBefore, bytes calldata signature)
        external
        nonReentrant
    {
        Payment storage p = payments[paymentKey(orderRef, payer)];
        if (p.payer == address(0)) revert UnknownOrder();
        if (amount == 0) revert BadAmount();
        uint256 done = p.refunded;
        uint256 total = done + amount;
        if (total > p.amount) revert RefundTooLarge();

        p.refunded = uint128(total);

        _pull(p.merchant, amount, validAfter, validBefore, refundNonce(orderRef, done, amount), signature);
        _send(p.payer, amount);

        emit Refunded(orderRef, p.payer, p.merchant, amount, total);
    }

    // ---------------------------------------------------------------- views

    /// @notice The EIP-3009 nonce a customer signs for an order. Binds the order and the stall into the signature.
    function payNonce(bytes32 orderRef, address merchant) public view returns (bytes32) {
        return keccak256(abi.encode("zeeto.pay", block.chainid, address(this), orderRef, merchant));
    }

    /// @notice The nonce a stall signs for a refund. `refundedSoFar` makes every refund unique and in order.
    function refundNonce(bytes32 orderRef, uint256 refundedSoFar, uint256 amount) public view returns (bytes32) {
        return keccak256(abi.encode("zeeto.refund", block.chainid, address(this), orderRef, refundedSoFar, amount));
    }

    /// @notice Payments are stored per (order, payer), so nobody but the real customer can occupy an order's slot
    ///         (front-running a payment with your own money to block someone else's order is impossible).
    function paymentKey(bytes32 orderRef, address payer) public pure returns (bytes32) {
        return keccak256(abi.encode(orderRef, payer));
    }

    function getPayment(bytes32 orderRef, address payer) external view returns (Payment memory) {
        return payments[paymentKey(orderRef, payer)];
    }

    // ---------------------------------------------------------------- admin: pause new payments only

    /// @notice Stops new payments in an emergency. Refunds keep working so customers can always get money back.
    ///         The owner can't move anyone's funds: this contract holds none and has no withdraw function.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert BadAddress();
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---------------------------------------------------------------- internals

    /// Pulls `amount` from `from` into this contract with their EIP-3009 authorization and checks it actually arrived.
    function _pull(address from, uint256 amount, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata sig) private {
        if (sig.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        uint256 before = usdt.balanceOf(address(this));
        usdt.receiveWithAuthorization(from, address(this), amount, validAfter, validBefore, nonce, v, r, s);
        if (usdt.balanceOf(address(this)) - before != amount) revert TransferFailed();
    }

    /// USDT-style tokens may return nothing; accept empty or `true`, revert on anything else.
    function _send(address to, uint256 amount) private {
        (bool ok, bytes memory ret) = address(usdt).call(abi.encodeWithSelector(IUSDT3009.transfer.selector, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
