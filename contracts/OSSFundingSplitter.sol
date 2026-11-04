// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OSSFundingSplitter
 * @notice Receives ETH from sponsors and credits it to a set of recipients
 *         according to a configurable, on-chain-readable split (in basis points).
 *
 * DESIGN PRINCIPLES
 * -----------------
 * 1. Pull payments: every recipient withdraws their own balance; the contract
 *    never pushes funds to multiple addresses in one transaction.
 * 2. CEI + ReentrancyGuard: balance is zeroed BEFORE the external call.
 * 3. No privileged drain: the owner can only reconfigure the split for *future*
 *    incoming funds; already-credited balances are unalterable by anyone except
 *    the recipient themselves.
 * 4. Exact accounting: every wei of msg.value is credited to someone.
 *    The integer-division remainder is assigned to the first recipient.
 * 5. Split validation: setSplit() reverts unless shares sum exactly to
 *    BASIS_POINTS (10 000).
 *
 * SPLIT FOR ANANYA'S DATE-PARSING LIBRARY
 * ----------------------------------------
 * Maintainer (Ananya)   : 2500 bp  (25 %)
 * Upstream lib 1        : 1000 bp  (10 %)
 * Upstream lib 2        : 1000 bp  (10 %)
 * Upstream lib 3        : 1000 bp  (10 %)
 * Contributor 1         :  700 bp  ( 7 %)
 * Contributor 2         :  700 bp  ( 7 %)
 * Contributor 3         :  700 bp  ( 7 %)
 * Contributor 4         :  700 bp  ( 7 %)
 * Contributor 5         :  700 bp  ( 7 %)
 * Sponsor reserve       : 1000 bp  (10 %)
 *                         ────────────────
 *                        10 000 bp (100 %)
 */
contract OSSFundingSplitter is ReentrancyGuard, Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 10 000 basis points = 100 %.  All share arrays must sum to this.
    uint256 public constant BASIS_POINTS = 10_000;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Ordered list of recipient addresses.
    address[] public recipients;

    /// @notice Basis-point share for each recipient (parallel to `recipients`).
    uint256[] public shares;

    /**
     * @notice Credited (but not yet withdrawn) ETH balance for each recipient.
     * @dev    This is the ONLY place keeper funds live once credited.
     *         No owner function can move these wei.
     */
    mapping(address => uint256) public balances;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event FundsReceived(address indexed sponsor, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);
    event SplitUpdated(address[] recipients, uint256[] shares);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _recipients Initial recipient addresses.
     * @param _shares     Basis-point shares; must sum to BASIS_POINTS.
     */
    constructor(
        address[] memory _recipients,
        uint256[] memory _shares
    ) Ownable(msg.sender) {
        _validateAndSetSplit(_recipients, _shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sponsor interface
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Send ETH here to fund the project.
     *         Every wei of msg.value is immediately credited to recipients.
     */
    receive() external payable {
        _distributeFunds(msg.value);
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice Explicit fund function (same behaviour as receive).
     */
    function fund() external payable {
        _distributeFunds(msg.value);
        emit FundsReceived(msg.sender, msg.value);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recipient interface
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw all ETH credited to msg.sender.
     * @dev    Checks-Effects-Interactions: balance zeroed before external call.
     *         Also protected by ReentrancyGuard.
     */
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "OSSFundingSplitter: nothing to withdraw");

        // EFFECT: clear balance before any external interaction
        balances[msg.sender] = 0;

        // INTERACTION: send ETH to the caller
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "OSSFundingSplitter: transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner interface  (split config only — cannot touch credited balances)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the split for *future* incoming funds.
     *         Already-credited balances are not affected.
     * @param _recipients New recipient list.
     * @param _shares     New shares list; must sum to BASIS_POINTS.
     */
    function setSplit(
        address[] calldata _recipients,
        uint256[] calldata _shares
    ) external onlyOwner {
        _validateAndSetSplit(_recipients, _shares);
        emit SplitUpdated(_recipients, _shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full recipients array (handy for frontends).
    function getRecipients() external view returns (address[] memory) {
        return recipients;
    }

    /// @notice Returns the full shares array (parallel to getRecipients).
    function getShares() external view returns (uint256[] memory) {
        return shares;
    }

    /// @notice Returns the number of recipients in the current split.
    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Distributes `amount` wei among recipients proportionally.
     *      Uses integer division; the remainder (amount % BASIS_POINTS at most)
     *      is assigned to the first recipient so no wei is stranded.
     *
     *      amount credited to recipient[i] = amount * shares[i] / BASIS_POINTS
     *      remainder                       = sum(credited) - amount  [≤ n-1 wei]
     *      remainder → recipients[0]
     */
    function _distributeFunds(uint256 amount) internal {
        require(amount > 0, "OSSFundingSplitter: zero value");
        require(recipients.length > 0, "OSSFundingSplitter: no recipients");

        uint256 distributed = 0;
        uint256 len = recipients.length;

        for (uint256 i = 0; i < len; ) {
            uint256 share = (amount * shares[i]) / BASIS_POINTS;
            balances[recipients[i]] += share;
            distributed += share;
            unchecked { ++i; }
        }

        // Assign any integer-division remainder to the first recipient.
        uint256 remainder = amount - distributed;
        if (remainder > 0) {
            balances[recipients[0]] += remainder;
        }
    }

    /**
     * @dev Validates that _recipients and _shares are consistent and stores them.
     *      Reverts if:
     *        - arrays have different lengths
     *        - any recipient is the zero address
     *        - shares do not sum exactly to BASIS_POINTS
     */
    function _validateAndSetSplit(
        address[] memory _recipients,
        uint256[] memory _shares
    ) internal {
        require(
            _recipients.length > 0,
            "OSSFundingSplitter: empty recipients"
        );
        require(
            _recipients.length == _shares.length,
            "OSSFundingSplitter: length mismatch"
        );

        uint256 total = 0;
        for (uint256 i = 0; i < _recipients.length; ) {
            require(
                _recipients[i] != address(0),
                "OSSFundingSplitter: zero address recipient"
            );
            total += _shares[i];
            unchecked { ++i; }
        }

        require(
            total == BASIS_POINTS,
            "OSSFundingSplitter: shares must sum to BASIS_POINTS"
        );

        recipients = _recipients;
        shares = _shares;
    }
}
