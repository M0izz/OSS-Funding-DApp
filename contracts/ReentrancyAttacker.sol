// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OSSFundingSplitter.sol";

/**
 * @title ReentrancyAttacker
 * @notice Test helper: tries to re-enter withdraw() on receipt of ETH.
 *         Used in the reentrancy-guard test to prove the guard works.
 */
contract ReentrancyAttacker {
    OSSFundingSplitter public splitter;
    uint256 public attackCount;
    bool public reentryAttempted;
    bool public reentryBlocked;
    bytes4 public reentryErrorSelector;

    constructor(address payable _splitter) {
        splitter = OSSFundingSplitter(_splitter);
    }

    /// @notice Fund the splitter and simultaneously register this contract
    ///         as a recipient so it has a balance to withdraw.
    function attack() external payable {
        splitter.fund{value: msg.value}();
        splitter.withdraw();
    }

    receive() external payable {
        attackCount++;
        if (address(splitter).balance > 0) {
            reentryAttempted = true;
            try splitter.withdraw() {
                // The test verifies this path is rejected by the guard.
            } catch (bytes memory reason) {
                reentryBlocked = true;
                reentryErrorSelector = bytes4(reason);
            }
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
