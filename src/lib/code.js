const { randomInt } = require("node:crypto");

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// randomInt is unbiased, unlike Math.random() or modulo on random bytes
function generateCode(length = 7) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

module.exports = { generateCode };
