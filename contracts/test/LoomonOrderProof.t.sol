// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonOrderProof } from "../src/LoomonOrderProof.sol";

interface ProofVm {
    function prank(address msgSender) external;
}

contract LoomonOrderProofTest {
    ProofVm private constant vm = ProofVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    LoomonOrderProof private proof;

    address private minter = address(0xA11CE);
    address private buyer = address(0xB0B);
    address private outsider = address(0xBAD);
    bytes32 private orderHash = keccak256("LM-26-07-A1B2C3");
    bytes32 private snapshotHash = keccak256("product-version-and-brief-v1");

    function setUp() public {
        proof = new LoomonOrderProof(address(this), minter);
    }

    function testAuthorizedMinterCreatesOneProof() public {
        vm.prank(minter);
        uint256 tokenId = proof.mintOrderProof(buyer, orderHash, snapshotHash);

        assertEq(tokenId, 1, "first token");
        assertEq(proof.ownerOf(tokenId), buyer, "owner");
        assertEq(proof.balanceOf(buyer), 1, "balance");
        assertEq(proof.tokenIdByOrderHash(orderHash), tokenId, "order lookup");
        assertEq(proof.orderHashByTokenId(tokenId), orderHash, "token order");
        assertEq(proof.snapshotHashByTokenId(tokenId), snapshotHash, "token snapshot");
    }

    function testUnauthorizedCallerCannotMint() public {
        vm.prank(outsider);
        (bool ok,) = address(proof)
            .call(abi.encodeCall(LoomonOrderProof.mintOrderProof, (buyer, orderHash, snapshotHash)));
        assertTrue(!ok, "unauthorized mint");
    }

    function testDuplicateOrderCannotMintTwice() public {
        vm.prank(minter);
        proof.mintOrderProof(buyer, orderHash, snapshotHash);

        vm.prank(minter);
        (bool ok,) = address(proof)
            .call(abi.encodeCall(LoomonOrderProof.mintOrderProof, (buyer, orderHash, snapshotHash)));
        assertTrue(!ok, "duplicate order");
    }

    function testZeroRecipientAndHashesRevert() public {
        vm.prank(minter);
        (bool zeroRecipient,) = address(proof)
            .call(
                abi.encodeCall(
                    LoomonOrderProof.mintOrderProof, (address(0), orderHash, snapshotHash)
                )
            );
        assertTrue(!zeroRecipient, "zero recipient");

        vm.prank(minter);
        (bool zeroOrder,) = address(proof)
            .call(
                abi.encodeCall(LoomonOrderProof.mintOrderProof, (buyer, bytes32(0), snapshotHash))
            );
        assertTrue(!zeroOrder, "zero order");

        vm.prank(minter);
        (bool zeroSnapshot,) = address(proof)
            .call(abi.encodeCall(LoomonOrderProof.mintOrderProof, (buyer, orderHash, bytes32(0))));
        assertTrue(!zeroSnapshot, "zero snapshot");
    }

    function testProofCannotBeTransferredOrApproved() public {
        vm.prank(minter);
        uint256 tokenId = proof.mintOrderProof(buyer, orderHash, snapshotHash);

        vm.prank(buyer);
        (bool transferOk,) = address(proof)
            .call(abi.encodeCall(LoomonOrderProof.transferFrom, (buyer, outsider, tokenId)));
        assertTrue(!transferOk, "transfer blocked");

        vm.prank(buyer);
        (bool approveOk,) =
            address(proof).call(abi.encodeCall(LoomonOrderProof.approve, (outsider, tokenId)));
        assertTrue(!approveOk, "approval blocked");

        vm.prank(buyer);
        (bool operatorOk,) = address(proof)
            .call(abi.encodeCall(LoomonOrderProof.setApprovalForAll, (outsider, true)));
        assertTrue(!operatorOk, "operator approval blocked");
    }

    function testMetadataIsOnchainAndInterfacesAreSupported() public {
        vm.prank(minter);
        uint256 tokenId = proof.mintOrderProof(buyer, orderHash, snapshotHash);

        string memory uri = proof.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 100, "metadata present");
        assertTrue(_startsWith(uri, "data:application/json;base64,"), "onchain json");
        assertTrue(proof.supportsInterface(0x01ffc9a7), "erc165");
        assertTrue(proof.supportsInterface(0x80ac58cd), "erc721");
        assertTrue(proof.supportsInterface(0x5b5e139f), "metadata");
    }

    function testAdminCanRotateMinterButOthersCannot() public {
        address newMinter = address(0xCAFE);
        proof.setMinter(newMinter);
        assertEq(proof.minter(), newMinter, "rotated");

        vm.prank(outsider);
        (bool ok,) = address(proof).call(abi.encodeCall(LoomonOrderProof.setMinter, (outsider)));
        assertTrue(!ok, "admin only");
    }

    function _startsWith(string memory value, string memory prefix) private pure returns (bool) {
        bytes memory valueBytes = bytes(value);
        bytes memory prefixBytes = bytes(prefix);
        if (valueBytes.length < prefixBytes.length) return false;
        for (uint256 index = 0; index < prefixBytes.length; index++) {
            if (valueBytes[index] != prefixBytes[index]) return false;
        }
        return true;
    }

    function assertEq(address actual, address expected, string memory reason) private pure {
        require(actual == expected, reason);
    }

    function assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        require(actual == expected, reason);
    }

    function assertEq(bytes32 actual, bytes32 expected, string memory reason) private pure {
        require(actual == expected, reason);
    }

    function assertTrue(bool condition, string memory reason) private pure {
        require(condition, reason);
    }
}
