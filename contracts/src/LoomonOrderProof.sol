// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Non-transferable ERC-721-compatible proof for a verified LOOMON demo order on Arc.
/// @dev The token certifies only that the demo order proof was minted. It does not certify
/// physical delivery, authenticity, title to goods, or investment value.
contract LoomonOrderProof {
    string public constant name = "LOOMON Order Proof";
    string public constant symbol = "LOOMON";

    address public immutable admin;
    address public minter;

    uint256 private _nextTokenId = 1;

    mapping(uint256 tokenId => address owner) private _owners;
    mapping(address owner => uint256 balance) private _balances;
    mapping(bytes32 orderHash => uint256 tokenId) public tokenIdByOrderHash;
    mapping(uint256 tokenId => bytes32 orderHash) public orderHashByTokenId;
    mapping(uint256 tokenId => bytes32 snapshotHash) public snapshotHashByTokenId;
    mapping(uint256 tokenId => uint64 mintedAt) public mintedAtByTokenId;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MinterUpdated(address indexed previousMinter, address indexed newMinter);
    event OrderProofMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed orderHash,
        bytes32 snapshotHash
    );

    error Unauthorized();
    error ZeroAddress();
    error ZeroHash();
    error DuplicateOrder();
    error NonexistentToken();
    error NonTransferable();

    constructor(address admin_, address initialMinter) {
        if (admin_ == address(0) || initialMinter == address(0)) revert ZeroAddress();
        admin = admin_;
        minter = initialMinter;
        emit MinterUpdated(address(0), initialMinter);
    }

    function setMinter(address newMinter) external {
        if (msg.sender != admin) revert Unauthorized();
        if (newMinter == address(0)) revert ZeroAddress();

        address previousMinter = minter;
        minter = newMinter;
        emit MinterUpdated(previousMinter, newMinter);
    }

    function mintOrderProof(address recipient, bytes32 orderHash, bytes32 snapshotHash)
        external
        returns (uint256 tokenId)
    {
        if (msg.sender != minter) revert Unauthorized();
        if (recipient == address(0)) revert ZeroAddress();
        if (orderHash == bytes32(0) || snapshotHash == bytes32(0)) revert ZeroHash();
        if (tokenIdByOrderHash[orderHash] != 0) revert DuplicateOrder();

        tokenId = _nextTokenId++;
        _owners[tokenId] = recipient;
        _balances[recipient] += 1;
        tokenIdByOrderHash[orderHash] = tokenId;
        orderHashByTokenId[tokenId] = orderHash;
        snapshotHashByTokenId[tokenId] = snapshotHash;
        mintedAtByTokenId[tokenId] = uint64(block.timestamp);

        emit Transfer(address(0), recipient, tokenId);
        emit OrderProofMinted(tokenId, recipient, orderHash, snapshotHash);
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function approve(address, uint256) external pure {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) external pure {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert NonTransferable();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f; // ERC-721 metadata
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);

        string memory tokenNumber = _toString(tokenId);
        string memory orderHash = _toHex(orderHashByTokenId[tokenId]);
        string memory snapshotHash = _toHex(snapshotHashByTokenId[tokenId]);
        string memory displayHash = _shortHash(orderHashByTokenId[tokenId]);
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">',
            '<rect width="1080" height="1080" fill="#0e100f"/>',
            '<rect x="54" y="54" width="972" height="972" rx="24" fill="none" stroke="#42433d" stroke-width="2"/>',
            '<path d="M84 132H996" stroke="#0ae448" stroke-width="6"/>',
            '<text x="84" y="224" fill="#fffce1" font-family="Arial,sans-serif" font-size="88" font-weight="700">LOOMON</text>',
            '<text x="84" y="282" fill="#7c7c6f" font-family="Arial,sans-serif" font-size="30" letter-spacing="7">ORDER PROOF</text>',
            '<text x="84" y="640" fill="#fffce1" font-family="Arial,sans-serif" font-size="292" font-weight="700">#',
            tokenNumber,
            "</text>",
            '<text x="84" y="802" fill="#abff84" font-family="Arial,sans-serif" font-size="34">ARC TESTNET &#183; DEMO</text>',
            '<text x="84" y="875" fill="#7c7c6f" font-family="monospace" font-size="28">ORDER ',
            displayHash,
            "</text>",
            '<text x="84" y="946" fill="#7c7c6f" font-family="Arial,sans-serif" font-size="24">No physical delivery or investment claim.</text>',
            "</svg>"
        );
        string memory encodedSvg = Base64.encode(bytes(svg));

        string memory json = string.concat(
            '{"name":"LOOMON Order Proof #',
            tokenNumber,
            '","description":"Non-transferable proof of a completed LOOMON demo order on Arc Testnet. It does not certify physical delivery, authenticity, title to goods, or investment value.",',
            '"image":"data:image/svg+xml;base64,',
            encodedSvg,
            '","attributes":[',
            '{"trait_type":"Network","value":"Arc Testnet"},',
            '{"trait_type":"Proof type","value":"Demo order"},',
            '{"trait_type":"Transferability","value":"Non-transferable"},',
            '{"trait_type":"Order hash","value":"',
            orderHash,
            '"},{"trait_type":"Snapshot hash","value":"',
            snapshotHash,
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _shortHash(bytes32 value) private pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes memory output = new bytes(18);
        output[0] = "0";
        output[1] = "x";
        for (uint256 index = 0; index < 8; index++) {
            uint8 current = uint8(value[index]);
            output[2 + index * 2] = alphabet[current >> 4];
            output[3 + index * 2] = alphabet[current & 0x0f];
        }
        return string(output);
    }

    function _toHex(bytes32 value) private pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes memory output = new bytes(66);
        output[0] = "0";
        output[1] = "x";
        for (uint256 index = 0; index < 32; index++) {
            uint8 current = uint8(value[index]);
            output[2 + index * 2] = alphabet[current >> 4];
            output[3 + index * 2] = alphabet[current & 0x0f];
        }
        return string(output);
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        bytes memory alphabet = "0123456789";
        uint256 digits;
        uint256 remaining = value;
        while (remaining != 0) {
            digits++;
            remaining /= 10;
        }
        bytes memory output = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            output[digits] = alphabet[value % 10];
            value /= 10;
        }
        return string(output);
    }
}

library Base64 {
    string internal constant TABLE =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory result) {
        if (data.length == 0) return "";

        string memory table = TABLE;
        uint256 encodedLength = 4 * ((data.length + 2) / 3);
        result = new string(encodedLength + 32);

        assembly ("memory-safe") {
            mstore(result, encodedLength)
            let tablePtr := add(table, 1)
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))
            let resultPtr := add(result, 32)

            for { } lt(dataPtr, endPtr) { } {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }

            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
        }
    }
}
