const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const vpcCidrBlock = new pulumi.Config("iac-pulumi").require("vpcCidrBlock");
const publicSubnetCidrs = new pulumi.Config("iac-pulumi").require("publicSubnetCidrs"); 
const parsedPublicSubnetCidrs = JSON.parse(publicSubnetCidrs);

const privateSubnetCidrs = new pulumi.Config("iac-pulumi").require("privateSubnetCidrs"); 
const parsedPrivateSubnetCidrs = JSON.parse(privateSubnetCidrs);

function createVPC() {
    const vpc = new aws.ec2.Vpc("my-vpc", {
        cidrBlock: vpcCidrBlock,
        enableDnsSupport: true,
        enableDnsHostnames: true,
    });

    return vpc;
}

async function createSubnets(vpc) {
    
    const zones = await aws.getAvailabilityZones({ state: "available" });
    const availabilityZones = zones.names.slice(0, 3);

    const publicSubnets = [];
    const privateSubnets = [];

    console.log(availabilityZones);
    availabilityZones.forEach((az, index) => {

        const publicSubnet = new aws.ec2.Subnet(`public-subnet-${index}`, {
            vpcId: vpc.id,
            cidrBlock: parsedPublicSubnetCidrs[index],
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags: { Name: `public-subnet-${index}` },
        });
        publicSubnets.push(publicSubnet);

        const privateSubnet = new aws.ec2.Subnet(`private-subnet-${index}`, {
            vpcId: vpc.id,
            cidrBlock: parsedPrivateSubnetCidrs[index],
            availabilityZone: az,
            tags: { Name: `private-subnet-${index}` },
        });
        privateSubnets.push(privateSubnet);

    });

    return { publicSubnets, privateSubnets };
}

module.exports = { createVPC, createSubnets };
