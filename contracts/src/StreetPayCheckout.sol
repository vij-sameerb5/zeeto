// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title StreetPayCheckout
/// @notice Pickup-order checkout for Zeeto. A customer pays a stall in USDT for one order, exactly once.
/// @dev Design (docs/ARCHITECTURE.md §5):
///  - The Zeeto API prices each order and signs a payment intent (EIP-712). The contract only accepts a payment
///    that matches a fresh, signed intent: right payer, right stall, right amount. That stops anyone from
///    paying an order to the wrong wallet, for the wrong amount, or front-running an order reference.
///  - USDT moves straight from the customer to the stall. This contract never holds funds.
///  - Each order reference can be paid once. Refunds are made by the stall, capped at what was paid.
///  - No external dependencies, so the audit surface is this file only.
contract StreetPayCheckout {
    // ---------------------------------------------------------------- types

    struct Intent {
        bytes32 orderRef; // keccak256(orderId, vendorId, chainId) made by the API
        address payer; // customer's embedded wallet
        address merchant; // stall's embedded wallet
        uint256 amount; // token base units (USDT: 6 decimals)
        uint256 expiresAt; // unix seconds
    }

    struct Payment {
        address payer;
        address merchant;
        uint128 amount;
        uint128 refunded;
        uint64 paidAt;
    }

    // ---------------------------------------------------------------- storage

    bytes32 private constant INTENT_TYPEHASH =
        keccak256("Intent(bytes32 orderRef,address payer,address merchant,uint256 amount,uint256 expiresAt)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    /// secp256k1n / 2, for rejecting malleable signatures
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    address public immutable token;
    bytes32 private immutable _domainSeparator;
    uint256 private immutable _chainId;

    address public owner;
    address public signer;
    bool public paused;
    mapping(bytes32 => Payment) public payments;

    uint256 private _lock = 1;

    // ---------------------------------------------------------------- events & errors

    event Paid(bytes32 indexed orderRef, address indexed payer, address indexed merchant, uint256 amount);
    event Refunded(bytes32 indexed orderRef, address indexed to, uint256 amount, uint256 totalRefunded);
    event SignerChanged(address indexed signer);
    event OwnerChanged(address indexed owner);
    event Paused(bool paused);

    error NotOwner();
    error NotMerchant();
    error NotPayer();
    error IsPaused();
    error AlreadyPaid();
    error UnknownOrder();
    error Expired();
    error BadSignature();
    error BadAmount();
    error BadAddress();
    error RefundTooLarge();
    error TransferFailed();
    error Reentrancy();

    // ---------------------------------------------------------------- setup

    constructor(address token_, address signer_) {
        if (token_.code.length == 0 || signer_ == address(0)) revert BadAddress();
        token = token_;
        signer = signer_;
        owner = msg.sender;
        _chainId = block.chainid;
        _domainSeparator = _buildDomain();
        emit OwnerChanged(msg.sender);
        emit SignerChanged(signer_);
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

    /// @notice Pay one order. The caller must be the intent's payer and must have approved `amount` to this contract.
    function pay(Intent calldata it, bytes calldata sig) external nonReentrant {
        if (paused) revert IsPaused();
        if (msg.sender != it.payer) revert NotPayer();
        if (block.timestamp > it.expiresAt) revert Expired();
        if (it.merchant == address(0) || it.merchant == it.payer) revert BadAddress();
        if (it.amount == 0 || it.amount > type(uint128).max) revert BadAmount();
        if (payments[it.orderRef].payer != address(0)) revert AlreadyPaid();
        if (_recover(_digest(it), sig) != signer) revert BadSignature();

        // effects before the token call
        payments[it.orderRef] = Payment({
            payer: it.payer,
            merchant: it.merchant,
            amount: uint128(it.amount),
            refunded: 0,
            paidAt: uint64(block.timestamp)
        });

        _transferFrom(it.payer, it.merchant, it.amount);
        emit Paid(it.orderRef, it.payer, it.merchant, it.amount);
    }

    // ---------------------------------------------------------------- refund

    /// @notice The stall refunds part or all of an order to the customer. Needs the stall's approval to this contract.
    function refund(bytes32 orderRef, uint256 amount) external nonReentrant {
        Payment storage p = payments[orderRef];
        if (p.payer == address(0)) revert UnknownOrder();
        if (msg.sender != p.merchant) revert NotMerchant();
        if (amount == 0) revert BadAmount();
        uint256 total = uint256(p.refunded) + amount;
        if (total > p.amount) revert RefundTooLarge();

        p.refunded = uint128(total);
        _transferFrom(p.merchant, p.payer, amount);
        emit Refunded(orderRef, p.payer, amount, total);
    }

    // ---------------------------------------------------------------- views

    function isPaid(bytes32 orderRef) external view returns (bool) {
        return payments[orderRef].payer != address(0);
    }

    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _chainId ? _domainSeparator : _buildDomain();
    }

    /// @notice The EIP-712 digest the API signs. Exposed so the API and tests can check they agree.
    function hashIntent(Intent calldata it) external view returns (bytes32) {
        return _digest(it);
    }

    // ---------------------------------------------------------------- admin (signer rotation and pause only)

    function setSigner(address s) external onlyOwner {
        if (s == address(0)) revert BadAddress();
        signer = s;
        emit SignerChanged(s);
    }

    function setOwner(address o) external onlyOwner {
        if (o == address(0)) revert BadAddress();
        owner = o;
        emit OwnerChanged(o);
    }

    /// @notice Stops new payments. Refunds keep working so customers can always get money back.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    // ---------------------------------------------------------------- internals

    function _buildDomain() private view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("StreetPayCheckout"), keccak256("1"), block.chainid, address(this))
        );
    }

    function _digest(Intent calldata it) private view returns (bytes32) {
        bytes32 h = keccak256(abi.encode(INTENT_TYPEHASH, it.orderRef, it.payer, it.merchant, it.amount, it.expiresAt));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), h));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address a) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) revert BadSignature();
        a = ecrecover(digest, v, r, s);
        if (a == address(0)) revert BadSignature();
    }

    /// @dev Works with tokens that return a bool and with tokens like Tether's USDT that return nothing.
    function _transferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
