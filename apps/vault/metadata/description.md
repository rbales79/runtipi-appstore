# HashiCorp Vault

HashiCorp Vault is an identity-based secrets and encryption management system. A secret is anything that you want to tightly control access to, such as API encryption keys, passwords, or certificates. Vault provides encryption services that are gated by authentication and authorization methods.

## Features

- **Secure Secret Storage**: Arbitrary key/value secrets can be stored in Vault
- **Dynamic Secrets**: Vault can generate secrets on-demand for some systems
- **Data Encryption**: Vault can encrypt and decrypt data without storing it
- **Leasing and Renewal**: All secrets in Vault have a lease associated with them
- **Revocation**: Vault has built-in support for secret revocation

## Initial Setup

1. Access Vault at `http://your-server:8200`
2. Initialize Vault with: `-key-shares=1 -key-threshold=1`
3. Save your unseal key and root token securely!
4. Unseal Vault using your single unseal key
5. Login with the root token
6. Configure authentication methods and policies

**Important**: This configuration uses a single unseal key for simplicity. Save it securely - you'll need it every time Vault restarts.

## Unsealing Vault

After container restarts, Vault will be sealed. You must unseal it:

- Navigate to the web UI and enter your unseal key
- Or use the CLI: `vault operator unseal`

## Documentation

For more information, visit the [official Vault documentation](https://developer.hashicorp.com/vault/docs).
