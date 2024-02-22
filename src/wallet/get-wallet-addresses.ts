import { deriveChildAccounts } from "../utilities";

// CONFIGURATION

const NETWORK = Bun.env.network;
const MNEMONIC = Bun.env.mnemonic;

// MAIN SCRIPT (DO NOT EDIT BELOW)

async function main() {
  // get account info from env
  const network = NETWORK;
  const mnemonic = MNEMONIC;
  const desiredIndex = 9; // hard-coded to return 10 addresses

  // check that values exist for each
  if (!network) {
    throw new Error("No network provided in environment variables");
  }
  if (!mnemonic) {
    throw new Error("No mnemonic provided in environment variables");
  }

  // get account addresses
  const addresses = await deriveChildAccounts(network, mnemonic, desiredIndex);

  // log account addresses with their index
  addresses.forEach((address, index) => {
    console.log(`${index}: ${address}`);
  });
}

main();