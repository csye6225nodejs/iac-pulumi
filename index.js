const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");

async function main() {
    const vpc = createVPC();
    const { publicSubnets, privateSubnets } = await createSubnets(vpc);
    
    const internetGateway = createInternetGateway(vpc);
    
    
    const vpcAttachment = new aws.ec2.InternetGatewayAttachment("my-igw-attachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id,
    });

    const publicRouteTable = createPublicRouteTable(vpc, publicSubnets, internetGateway);
    const privateRouteTable = createPrivateRouteTable(vpc, privateSubnets);
}

main();

