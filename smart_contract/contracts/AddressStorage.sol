// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AddressStorage {
    address public owner;
    bytes[] public dataList;
    uint256[] public timestampList;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    function addData(bytes memory _data) public onlyOwner {
        require(_data.length > 0, "Empty data");
        dataList.push(_data);
        timestampList.push(block.timestamp);
    }
    
    function getAllEntries() public view returns (bytes[] memory, uint256[] memory) {
        return (dataList, timestampList);
    }
}
