import { getNonce } from "@stacks/transactions";
import { deriveChildAccount } from "../utilities";

// CONFIGURATION

const NETWORK = Bun.env.network;
const MNEMONIC = Bun.env.mnemonic;
const ACCOUNT_INDEX = Bun.env.accountIndex;

// MAIN SCRIPT (DO NOT EDIT BELOW)

async function main() {
  // get account info from env
  const network = NETWORK;
  const mnemonic = MNEMONIC;
  const accountIndex = ACCOUNT_INDEX;
  // check that values exist for each
  if (!network) {
    throw new Error("No network provided in environment variables");
  }
  if (!mnemonic) {
    throw new Error("No mnemonic provided in environment variables");
  }
  if (!accountIndex) {
    throw new Error("No account index provided in environment variables");
  }
  // get account address
  const { address } = await deriveChildAccount(network, mnemonic, accountIndex);
  // get the current nonce for the account
  const nonce = await getNonce(address, network);
  // log the account info
  console.log(`Account index: ${accountIndex}`);
  console.log(`Account address: ${address}`);
  console.log(`Nonce: ${nonce}`);
}

main();