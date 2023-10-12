const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const  subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");

async function main() {
    const vpc = createVPC();
    const { publicSubnets, privateSubnets } = await createSubnets(vpc);
    
    const internetGateway = createInternetGateway(vpc);
    
    
    const vpcAttachment = new aws.ec2.InternetGatewayAttachment("my-igw-attachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id,
    });

    //subnet 
    const [ipAddress, subnetMask] = subnetcidr.split('/');
    const probabal_subnets = SubnetCIDRAdviser.calculate(ipAddress, 16);

    console.log(probabal_subnets);
    const publicRouteTable = createPublicRouteTable(vpc, publicSubnets, internetGateway);
    const privateRouteTable = createPrivateRouteTable(vpc, privateSubnets);
}

main();

