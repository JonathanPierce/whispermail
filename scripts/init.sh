git submodule update --init --recursive
cd client
npm install
./node_modules/.bin/electron-rebuild
cd ../server
npm install
