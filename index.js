const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const ami_id = new pulumi.Config("iac-pulumi").require("ami_id");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const  subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");

async function main() {
    const vpc = createVPC();
    const { publicSubnets, privateSubnets } = await createSubnets(vpc);
    
    const publicKey = fs.readFileSync('keypairgen.pub', 'utf-8');
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
            volumeSize: 25, // Root volume size of 25 GB
            volumeType: "gp2", // General Purpose SSD (GP2)
        },
        tags: {
            Name: "Abhishek-EC2Instance", // Replace with a suitable name
        },
    });
    
    

const ingressRules = [
    {
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        cidrBlocks: ["0.0.0.0/0"], // Allows SSH from anywhere
    },
    {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ["0.0.0.0/0"], // Allows HTTP from anywhere
    },
    {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ["0.0.0.0/0"],
        // Allows HTTPS from anywhere
    },
    {
        protocol: "tcp",
        fromPort: 8080,
        toPort: 8080,
        cidrBlocks: ["0.0.0.0/0"]
    }
    // Add an ingress rule for your application port (e.g., 8080) as needed
];

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

