/*
Derive an AES key, given:
- our ECDH private key
- their ECDH public key
*/
export function deriveSecretKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export type Message = {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

export async function encrypt(
  secretKey: CryptoKey,
  message: string
): Promise<Message> {
  const enc = new TextEncoder();
  const data = enc.encode(message);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    secretKey,
    data
  );

  return {
    iv,
    ciphertext,
  };
}

export async function decrypt(
  secretKey: CryptoKey,
  message: Message
): Promise<string> {
  const {iv, ciphertext} = message;
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    secretKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-384",
    },
    true,
    ["deriveKey"]
  );
}

// WARN: Don't fucking change this value
const ivLength = 12;

export function combineMessage(message: Message): ArrayBuffer {
  const {iv, ciphertext} = message;
  const ivView = new Uint8Array(iv);
  const ciphertextView = new Uint8Array(ciphertext);

  const combined = new Uint8Array(ivLength + ciphertext.byteLength);
  combined.set(ivView);
  combined.set(ciphertextView, ivLength);

  return combined.buffer;
}

export function extractMessage(data: ArrayBuffer): Message {
  const view = new Uint8Array(data);
  const iv = view.slice(0, ivLength);
  const ciphertext = view.slice(ivLength);

  return {
    iv: iv.buffer,
    ciphertext: ciphertext.buffer,
  };
}
