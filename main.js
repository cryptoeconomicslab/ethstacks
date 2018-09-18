const ChildChain = require("./childchain/lib")
const Listener = require("./listener/lib")
const Rpc = require("./rpc/lib")


async function main(){
    let childChain = await ChildChain.run()
    Listener.run(childChain)
    Rpc.run(childChain)
    childChain.emit("Ready", {});
    return true;
}

main().then(_=> console.log("Done.") ).catch(e=> console.error(e) )