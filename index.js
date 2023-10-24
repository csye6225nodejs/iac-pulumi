const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const ami_id = new pulumi.Config("iac-pulumi").require("ami_id");
const { createVPC, createSubnets } = require("./vpc");
const { createRdsInstance } = require('./rds');
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const { Endpoint } = require("@pulumi/aws/dms");
const { RdsDbInstance } = require("@pulumi/aws/opsworks");
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

    const dbSecurityGroup = await createRDSSecurityGroup(applicationSecurityGroup, vpc);
    const rdsInstance = await createRdsInstance(dbSecurityGroup,privateSubnets );

    pulumi.all({
        dbId: rdsInstance.dbInstanceIdentifier,
        dbAddress: rdsInstance.address,
        dbPort:    rdsInstance.port,
    }).apply(async(outputs) => {
        // Define EC2 userData script
        const userDataScript = `#!/bin/bash
            echo "export DB_NAME=${outputs.dbId}" >> /opt/webapp/.env
            echo "export DB_PORT=${outputs.dbPort}" >> /opt/webapp/.env
            echo "export DB_HOST=${outputs.dbAddress}" >> /opt/webapp/.env
            source /etc/environment
            # Start your Nodejs application here
        `;
    
        // Create EC2 instance
        const ec2Instance = new aws.ec2.Instance("my-ec2-instance", {
            ami: ami_id, // Replace with your custom AMI ID
            instanceType: "t2.micro",   
            subnetId: publicSubnets[0],
            vpcSecurityGroupIds: [applicationSecurityGroup.id], // Attach the security group
            keyName: keyPair.keyName,
            userData: userDataScript,
            disableApiTermination: false, // No protection against accidental termination
            rootBlockDevice: {
                volumeSize: volumeSize, // Root volume size of 25 GB
                volumeType: volumeType, // General Purpose SSD (GP2)
            },
            tags: {
                Name: "Abhishek-EC2Instance", // Replace with a suitable name
            },
        }); 
    
    });
    
 
        //create ec2 instance
    

    const publicRouteTable = createPublicRouteTable(vpc, publicSubnets, internetGateway);
    const privateRouteTable = createPrivateRouteTable(vpc, privateSubnets);
}


async function createRDSSecurityGroup(applicationSecurityGroup, vpc) {

    // Your RDS security group creation code goes here
    const dbSecurityGroup = new aws.ec2.SecurityGroup("database-security-group", {
        name: "database-security-group",
        description: "Security group for RDS instances",
        vpcId: vpc.id
    });

    // Example rule for MySQL on port 3306
    new aws.ec2.SecurityGroupRule("db-ingress-rule-mysql", {
        type: "ingress",
        fromPort: 3306, // Change to the desired database port
        toPort: 3306,
        protocol: "tcp",
        securityGroupId: dbSecurityGroup.id,
        sourceSecurityGroupId: applicationSecurityGroup.id,
    });

    // Return the created security group if needed
    return dbSecurityGroup;
}


main();

