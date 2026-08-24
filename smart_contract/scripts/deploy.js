import { network } from "hardhat";

const { ethers } = await network.create();


async function main() {
  const addressStorage = await ethers.deployContract("AddressStorage");

  console.log("AddressStorage:", addressStorage);
  console.log("AddressStorage address:", addressStorage.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
