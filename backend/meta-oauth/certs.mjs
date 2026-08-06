import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const certDir = resolve(process.cwd(), ".local/certs");
const keyPath = resolve(certDir, "localhost-key.pem");
const certPath = resolve(certDir, "localhost-cert.pem");
const opensslConfigPath = resolve(certDir, "localhost.cnf");

function writeOpensslConfig() {
  writeFileSync(
    opensslConfigPath,
    `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
`
  );
}

export function ensureLocalHttpsCerts() {
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
      keyPath,
      certPath
    };
  }

  mkdirSync(certDir, { recursive: true, mode: 0o700 });
  writeOpensslConfig();

  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "825",
        "-nodes",
        "-config",
        opensslConfigPath
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(
      `Không tạo được chứng chỉ HTTPS local. Cần OpenSSL trên máy. Chi tiết: ${detail}`
    );
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
    keyPath,
    certPath
  };
}
