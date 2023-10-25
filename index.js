const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const ami_id = new pulumi.Config("iac-pulumi").require("ami_id");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");
const destinationCidr = new pulumi.Config("iac-pulumi").require("destinationCidr");
const mysqlfamily = new pulumi.Config("iac-pulumi").require("mysqlfamily");
const ports = new pulumi.Config("iac-pulumi").require("ports");
const pubkey = new pulumi.Config("iac-pulumi").require("pubkey");
const volumeSize = new pulumi.Config("iac-pulumi").require("volumeSize");
const volumeType = new pulumi.Config("iac-pulumi").require("volumeType");
const sqlport = new pulumi.Config("iac-pulumi").require("sqlport")
const protocol = new pulumi.Config("iac-pulumi").require("protocol")
const instanceType = new pulumi.Config("iac-pulumi").require("instanceType");
const skipFinalSnapshot = new pulumi.Config("iac-pulumi").require("skipFinalSnapshot");
const password = new pulumi.Config("iac-pulumi").require("password");
const username = new pulumi.Config("iac-pulumi").require("username");
const db_name = new pulumi.Config("iac-pulumi").require("db_name");
const instanceClass = new pulumi.Config("iac-pulumi").require("instanceClass");
const storageType = new pulumi.Config("iac-pulumi").require("storageType");
const allocatedStorage = new pulumi.Config("iac-pulumi").require("allocatedStorage");
const engine = new pulumi.Config("iac-pulumi").require("engine");
const parameter_name = new pulumi.Config("iac-pulumi").require("parameter_name");
const max_conn = new pulumi.Config("iac-pulumi").require("max_conn");
const fromPort = new pulumi.Config("iac-pulumi").require("fromPort");
const toPort = new pulumi.Config("iac-pulumi").require("toPort");

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
            protocol: protocol,
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
 

    // Create an RDS Parameter Group
    const dbparametergroup = new aws.rds.ParameterGroup("dbparametergroup", {
        family: mysqlfamily, // Use the appropriate parameter group family
        description: "Custom DB parameter group",
        parameters: [
        {
            name: parameter_name,
            value: max_conn
        },],
    });

    const dbsubnetgroup = new aws.rds.SubnetGroup("dbsubnetgroup", {
        subnetIds: privateSubnets,
    });

    // Create the RDS Instance
    const rdsinstance = new aws.rds.Instance("rdsinstance", {
        
        allocatedStorage: allocatedStorage,
        storageType: storageType,
        engine: engine, // Change to "mariadb" or "postgres" as needed
        instanceClass: instanceClass, // Choose the instance class you want
        dbName: db_name,
        username: username,
        password: password,
        skipFinalSnapshot: skipFinalSnapshot,
        dbSubnetGroupName: dbsubnetgroup,
        vpcSecurityGroupIds: [dbSecurityGroup.id],
        parameterGroupName: dbparametergroup.name,
    },{dependsOn: dbsubnetgroup});
    
       // #region User Data Script
       const userDataScript = pulumi.all([rdsinstance.dbName, rdsinstance.username, rdsinstance.password,rdsinstance.address]).apply(([dbname, dbusername, dbpassword, dbhost]) => {
        return `#!/bin/bash
        echo "DB_NAME=${dbname}" >> /opt/webapp/.env
        echo "DB_USER=${dbusername}" >> /opt/webapp/.env
        echo "DB_PASSWORD=${dbpassword}" >> /opt/webapp/.env
        echo "DB_HOST=${dbhost}" >> /opt/webapp/.env
        sudo systemctl enable webapp.service
        sudo systemctl start webapp.service
        `;
    });
    // #endregion

    new aws.ec2.SecurityGroupRule("ec2-outbound-rule-rds", {
        type: "egress",
        fromPort: fromPort,       // Allow outgoing connections from any port
        toPort: toPort,     // To any port
        protocol: protocol,
        securityGroupId: applicationSecurityGroup.id,
        cidrBlocks: [destinationCidr] // Allow outgoing connections to the RDS endpoint
    },{dependsOn: [rdsinstance, applicationSecurityGroup] });
    

        // Create EC2 instance
    const ec2Instance = new aws.ec2.Instance("my-ec2-instance", {
            ami: ami_id, // Replace with your custom AMI ID
            instanceType: instanceType,   
            subnetId: publicSubnets[0],
            vpcSecurityGroupIds: [applicationSecurityGroup.id], // Attach the security group
            keyName: keyPair.keyName,
            disableApiTermination: false, // No protection against accidental termination
            rootBlockDevice: {
                volumeSize: volumeSize, // Root volume size of 25 GB
                volumeType: volumeType, // General Purpose SSD (GP2)
            },
            userData: pulumi.interpolate`${userDataScript}`,
            tags: {
                Name: "Abhishek-EC2Instance", // Replace with a suitable name
            },
    }, {dependsOn: [rdsinstance,dbSecurityGroup]});

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
        fromPort: sqlport, // Change to the desired database port
        toPort: sqlport,
        protocol: protocol,
        securityGroupId: dbSecurityGroup.id,
        sourceSecurityGroupId: applicationSecurityGroup.id,
    }, {dependsOn: [dbSecurityGroup, applicationSecurityGroup]});


    // Return the created security group if needed
    return dbSecurityGroup;
}


main();

