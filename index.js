const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const ami_id = new pulumi.Config("iac-pulumi").require("ami_id");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const  subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");
const  destinationCidr = new pulumi.Config("iac-pulumi").require("destinationCidr");
const ports = new pulumi.Config("iac-pulumi").require("ports");
const pubkey = new pulumi.Config("iac-pulumi").require("pubkey");
const volumeSize = new pulumi.Config("iac-pulumi").require("volumeSize");
const volumeType = new pulumi.Config("iac-pulumi").require("volumeType");

async function main() {
    const vpc = createVPC();
    const { publicSubnets, privateSubnets } = await createSubnets(vpc);
    
    const publicKey = fs.readFileSync(pubkey, 'utf-8');
    const keyPair = new aws.ec2.KeyPair("myKeyPair", { publicKey });

    const internetGateway = createInternetGateway(vpc);
    
    const vpcAttachment = new aws.ec2.InternetGatewayAttachment("my-igw-attachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id,
    });

    //create application security group
    const applicationSecurityGroup = new aws.ec2.SecurityGroup("application-security-group", {
        name: "application-security-group",
        description: "Security group for web applications",
        vpcId: vpc.id, // Replace with your VPC ID
    });

    //create ec2 instance
    const ec2Instance = new aws.ec2.Instance("my-ec2-instance", {
        ami: ami_id, // Replace with your custom AMI ID
        instanceType: "t2.micro",   
        subnetId: publicSubnets[0],
        vpcSecurityGroupIds: [applicationSecurityGroup.id], // Attach the security group
        keyName: keyPair.keyName,
        disableApiTermination: false, // No protection against accidental termination
        rootBlockDevice: {
            volumeSize: volumeSize, // Root volume size of 25 GB
            volumeType: volumeType, // General Purpose SSD (GP2)
        },
        tags: {
            Name: "Abhishek-EC2Instance", // Replace with a suitable name
        },
    });

    const ingressPorts = JSON.parse(ports);

    const ingressRules = ingressPorts.map((port) => {
        return {
            protocol: "tcp",
            fromPort: port,
            toPort: port,
            cidrBlocks: [destinationCidr], // Allows access from anywhere
        };
    });

ingressRules.forEach((rule, index) => {
    const ruleName = `ingress-rule-${index}`;
    new aws.ec2.SecurityGroupRule(ruleName, {
        type: "ingress",
        fromPort: rule.fromPort,
        toPort: rule.toPort,
        protocol: rule.protocol,
        securityGroupId: applicationSecurityGroup.id,
        cidrBlocks: rule.cidrBlocks,
    });
});


    //subnet 
    const [ipAddress, subnetMask] = subnetcidr.split('/');
    const probabal_subnets = SubnetCIDRAdviser.calculate(ipAddress, 16);

    console.log(probabal_subnets);
    const publicRouteTable = createPublicRouteTable(vpc, publicSubnets, internetGateway);
    const privateRouteTable = createPrivateRouteTable(vpc, privateSubnets);
}

main();

