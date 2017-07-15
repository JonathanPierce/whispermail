# WhisperMail
An easy to use, decentralized, end-to-end encrypted email analogue based on the Signal Protocol.

## Design
- Client and server both encrypt data at rest, secured via a password.
- Server only retains messages until retreived, and stored minimal metadata in plaintext.
- Clients authenticate to the server by signing challenges from the server.
- Signal protocol is used to end-to-end encrypt messages.
- Signal protocol provides greater ease-of-use than PGP, along with greater security.

## TODO

- Improved server request validation
- Rudimentary UI for sending/receiving
- Document server config
- Add IP whitelist/blacklist to server
- Invite codes
- HTTPS support (while keeping local dev) - self-signed certs for dev?
- Improved login UI / start using SCSS
- Figure out server logging
- Message etadata / read status / folders / etc..
- Build the full UI
- Database import/export
