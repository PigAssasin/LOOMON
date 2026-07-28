// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Arc registry for LOOMON seller quote decisions.
/// @dev Detailed quote/request data stays in Supabase; Arc stores the signed
/// seller decision trail that the server verifies before projecting DB state.
contract LoomonQuoteDecision {
    error InvalidDecision();
    error Unauthorized();
    error ZeroAddress();
    error ZeroHash();

    address public immutable seller;

    event QuoteRequestDecided(
        bytes32 indexed requestIdHash,
        address indexed seller,
        uint8 indexed decision,
        bytes32 decisionHash
    );

    constructor(address seller_) {
        if (seller_ == address(0)) revert ZeroAddress();
        seller = seller_;
    }

    function decide(bytes32 requestIdHash, uint8 decision, bytes32 decisionHash) external {
        if (msg.sender != seller) revert Unauthorized();
        if (requestIdHash == bytes32(0) || decisionHash == bytes32(0)) revert ZeroHash();
        if (decision != 1 && decision != 2) revert InvalidDecision();
        emit QuoteRequestDecided(requestIdHash, msg.sender, decision, decisionHash);
    }
}
