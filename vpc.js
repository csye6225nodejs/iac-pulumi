const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const vpcCidrBlock = new pulumi.Config("iac-pulumi").require("vpcCidrBlock");
//const publicSubnetCidrs = new pulumi.Config("iac-pulumi").require("publicSubnetCidrs"); 
//const parsedPublicSubnetCidrs = JSON.parse(publicSubnetCidrs);

//const privateSubnetCidrs = new pulumi.Config("iac-pulumi").require("privateSubnetCidrs"); 
//const parsedPrivateSubnetCidrs = JSON.parse(privateSubnetCidrs);

const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const  subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");

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
    let availabilityZones = zones.names.slice(0, 3);

    const publicSubnets = [];
    const privateSubnets = [];

    const [ipAddress, subnetMask] = subnetcidr.split('/');
    const probabal_subnets = SubnetCIDRAdviser.calculate(ipAddress, subnetMask);

    console.log(availabilityZones);
    //availabilityZones = [ 'us-east-1a', 'us-east-2a', 'us-west-1a' ];
    availabilityZones.forEach((az, index) => {

        
        const publicSubnet = new aws.ec2.Subnet(`public-subnet-${index}`, {
            vpcId: vpc.id,
            cidrBlock: probabal_subnets.subnets[index].value,
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags: { Name: `public-subnet-${index}` },
        });
        publicSubnets.push(publicSubnet);

        const privateSubnet = new aws.ec2.Subnet(`private-subnet-${index}`, {
            vpcId: vpc.id,
            cidrBlock: probabal_subnets.subnets[index+3].value,
            availabilityZone: az,
            tags: { Name: `private-subnet-${index}` },
        });
        privateSubnets.push(privateSubnet);

    });

    return { publicSubnets, privateSubnets };
}

module.exports = { createVPC, createSubnets };
