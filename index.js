const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const fs = require("fs");
const SubnetCIDRAdviser = require("subnet-cidr-calculator");
const ami_id = new pulumi.Config("iac-pulumi").require("ami_id");
const { createVPC, createSubnets } = require("./vpc");
const { createInternetGateway, createPublicRouteTable, createPrivateRouteTable } = require("./networking");
const { prototype } = require("events");
const subnetcidr = new pulumi.Config("iac-pulumi").require("subnetCidr");
const destinationCidr = new pulumi.Config("iac-pulumi").require("destinationCidr");
const mysqlfamily = new pulumi.Config("iac-pulumi").require("mysqlfamily");
const ports = new pulumi.Config("iac-pulumi").require("ports");
const loadingports = new pulumi.Config("iac-pulumi").require("loadingports");
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
const hostedZone = new pulumi.Config("iac-pulumi").require("ZoneId");
const domainname = new pulumi.Config("iac-pulumi").require("domainname");
const loggroupname = new pulumi.Config("iac-pulumi").require("loggroupname");
const logstreamname = new pulumi.Config("iac-pulumi").require("logstreamname");
const snsTopic = new pulumi.Config("iac-pulumi").require("snsTopic");

const httpPort = new pulumi.Config("iac-pulumi").require("httpPort");
const httpsPort = new pulumi.Config("iac-pulumi").require("httpsPort");
const sshPort = new pulumi.Config("iac-pulumi").require("sshPort");
const applnPort = new pulumi.Config("iac-pulumi").require("applnPort");
const allport = new pulumi.Config("iac-pulumi").require("allport");
const allprotocol = new pulumi.Config("iac-pulumi").require("allprotocol");
const api_testing = new pulumi.Config("iac-pulumi").require("api_testing");
const device_path = new pulumi.Config("iac-pulumi").require("device_path");
const http_protocol = new pulumi.Config("iac-pulumi").require("http_protocol");
const statistic = new pulumi.Config("iac-pulumi").require("statistic");
const threshold = new pulumi.Config("iac-pulumi").require("threshold");
const policyType_val = new pulumi.Config("iac-pulumi").require("policyType_val");
const cooldown_time = new pulumi.Config("iac-pulumi").require("cooldown_time");

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

    //create load balancer security group
    const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup("load-balancer-security-group", {
        name: "load-balancer-security-group",
        description: "Security group for load balancer in the application",
        vpcId: vpc.id, // Replace with your VPC ID
    });

    const ingressPorts = JSON.parse(ports);

    const loadPorts = JSON.parse(loadingports);

    const ingressRules = ingressPorts.map((port) => {
        return {
            protocol: protocol,
            fromPort: port,
            toPort: port,
            cidrBlocks: [destinationCidr], // Allows access from anywhere
        };
    });

    const loadIngressRules = loadPorts.map((port) => {
        return {
            protocol: protocol,
            fromPort: port,
            toPort: port,
            cidrBlocks: [destinationCidr], // Allows access from anywhere
        };
    });

   /* ingressRules.forEach((rule, index) => {
        const ruleName = `ingress-rule-${index}`;
        new aws.ec2.SecurityGroupRule(ruleName, {
            type: "ingress",
            fromPort: rule.fromPort,
            toPort: rule.toPort,
            protocol: rule.protocol,
            securityGroupId: applicationSecurityGroup.id,
            securityGroups: [loadBalancerSecurityGroup.id],
            cidrBlocks: rule.cidrBlocks,
        });
    },{dependsOn:[loadBalancerSecurityGroup]});

    loadIngressRules.forEach((rule, index) => {
        const ruleName = `load-ingress-rule-${index}`;
        
    });*/

    const LoadIngressRule0 = new aws.ec2.SecurityGroupRule('load-ingress-rule-0', {
        type: "ingress",
        fromPort: httpPort,
        toPort: httpPort,
        protocol: protocol,
        cidrBlocks: [destinationCidr],
        securityGroupId: loadBalancerSecurityGroup.id
    },{dependsOn:[loadBalancerSecurityGroup]});

    const LoadIngressRule1 = new aws.ec2.SecurityGroupRule('load-ingress-rule-1', {
        type: "ingress",
        fromPort: httpsPort,
        toPort: httpsPort,
        protocol: protocol,
        securityGroupId: loadBalancerSecurityGroup.id,
        cidrBlocks: [destinationCidr],
    },{dependsOn: [loadBalancerSecurityGroup]});

    const IngressRule0 = new aws.ec2.SecurityGroupRule('ingress-rule-0', {
        type: "ingress",
        fromPort: sshPort,
        toPort: sshPort,
        protocol: protocol,
        cidrBlocks: [destinationCidr],
        securityGroupId: applicationSecurityGroup.id,
    },{dependsOn:[applicationSecurityGroup]});

    const IngressRule1 = new aws.ec2.SecurityGroupRule('ingress-rule-1', {
        type: "ingress",
        fromPort: applnPort,
        toPort: applnPort,
        protocol: protocol,
        sourceSecurityGroupId: loadBalancerSecurityGroup.id,
        securityGroupId: applicationSecurityGroup.id,
    },{dependsOn: [applicationSecurityGroup, loadBalancerSecurityGroup]});

    new aws.ec2.SecurityGroupRule("ec2-outbound-rule-rds", {
        type: "egress",
        fromPort: allport,       // Allow outgoing connections from any port
        toPort: allport,     // To any port
        protocol: allprotocol,
        securityGroupId: applicationSecurityGroup.id,
        cidrBlocks: [destinationCidr] // Allow outgoing connections to the RDS endpoint
    },{dependsOn: [ applicationSecurityGroup] });

    new aws.ec2.SecurityGroupRule("ec2-outbound-rule-loadbalancer", {
        type: "egress",
        fromPort: allport,       // Allow outgoing connections from any port
        toPort: allport,     // To any port
        protocol: allprotocol,
        securityGroupId: loadBalancerSecurityGroup.id,
        cidrBlocks: [destinationCidr] // Allow outgoing connections to the RDS endpoint
    },{dependsOn: [ loadBalancerSecurityGroup] });


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

    const serviceAccount = new gcp.serviceaccount.Account("my-service-account", {
        accountId: "my-service-account",
        displayName: "My Service Account",
        project: "dev-csye6225-fall2023",
    });
    const serviceAccountKey = new gcp.serviceaccount.Key("my-service-account-key", {
        serviceAccountId: serviceAccount.name,
    },{dependsOn: serviceAccount});

    const storageAdminRoleBinding = new gcp.projects.IAMMember("grant-storage-admin-role", {
        member: serviceAccount.email.apply(email => `serviceAccount:${email}`),
        role: "roles/storage.admin",
        project: "dev-csye6225-fall2023",
    }, { dependsOn: serviceAccount });

    const lambdaRole = new aws.iam.Role("lambdaRole", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Action: "sts:AssumeRole",
                Principal: {
                    Service: "lambda.amazonaws.com",
                },
                Effect: "Allow",
                Sid: "",
            }],
        }),
    });

    new aws.iam.RolePolicyAttachment("lambdaFullAccess", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
    });

    new aws.iam.RolePolicyAttachment("lambdaBasicExecutionRole", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }, { dependsOn: lambdaRole });

    const lambda = new aws.lambda.Function("mylambda", {
        code: new pulumi.asset.AssetArchive({
            ".": new pulumi.asset.FileArchive("./../serverless.zip"), // replace with your directory
        }),
        role: lambdaRole.arn,
        runtime: "nodejs20.x",
        handler: 'index.handler',  // replace with your handler
        environment: {
            variables: {
                "GOOGLE_CREDENTIALS": serviceAccountKey.privateKey,
            }
        }
    }, { dependsOn: serviceAccountKey });

    const topic = new aws.sns.Topic("myUserTopic");

    const permission = new aws.lambda.Permission("my-permission", {
        action: "lambda:InvokeFunction",
        function: lambda,
        principal: "sns.amazonaws.com",
        sourceArn: topic.arn,
    },{dependsOn: lambda});

    // Create a subscription to the just created SNSTopic
    const subscription = topic.onEvent("my-subscription", lambda);


    
       // #region User Data Script
       const userDataScript = pulumi.all([rdsinstance.dbName, rdsinstance.username, rdsinstance.password,rdsinstance.address,sns.arn]).apply(([dbname, dbusername, dbpassword, dbhost,sns]) => {
        return `#!/bin/bash
        sudo chown csye6625user:csye6225group -R /opt/webapp
        echo "DB_NAME=${dbname}" >> /opt/webapp/.env
        echo "DB_USER=${dbusername}" >> /opt/webapp/.env
        echo "DB_PASSWORD=${dbpassword}" >> /opt/webapp/.env
        echo "DB_HOST=${dbhost}" >> /opt/webapp/.env
        echo "SNS=${sns}" >> /opt/webapp/.env 
        sudo cd /opt/webapp
        sudo mkdir logs
        sudo cd logs
        sudo touch csye6225.log
        sudo chown csye6225user:csye6225group -R /opt/webapp/logs
        sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -c file:/opt/webapp/config/cloudwatch-config.json \
        -s
        sudo systemctl enable webapp.service
        sudo systemctl start webapp.service
        `;
    });
    // #endregion

    const encodedUserData = userDataScript.apply(script => Buffer.from(script).toString('base64'));
    // Creating a new IAM Role
    const role = new aws.iam.Role("role", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Principal: {
                        Service: "ec2.amazonaws.com"
                    },
                    Effect: "Allow",
                },
            ],
        }),
    });

    // Creating a new IAM Role Policy Attachment for CloudWatchAgentServerPolicy
    const cloudWatchFullAccess = new aws.iam.RolePolicyAttachment("cloudWatchAgentServerPolicyAttachment", {
        role: role.name,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"   // CloudWatchAgentServerPolicy ARN
    }, {dependsOn: [role]});

    const AmazonSNSFullAccess = new aws.iam.RolePolicyAttachment("SNSPolicyAttachment",{
        role: role.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonSNSFullAccess"
    },{dependsOn:[role]});


    // Creating an IAM Instance Profile which will be later be attached to the EC2 instance
    const instanceProfile = new aws.iam.InstanceProfile("instanceProfile", {
        role: role.name
    },{dependsOn: [role, cloudWatchFullAccess, AmazonSNSFullAccess]});

    const logGroup = new aws.cloudwatch.LogGroup("csye6225LogGroup", {
        name: loggroupname,
    });

    const logStream = new aws.cloudwatch.LogStream("WebappLogStream", {
        name: logstreamname,
        logGroupName: logGroup.name,
    }, { dependsOn: logGroup });


    const loadBalancer = new aws.lb.LoadBalancer("loadBalancer", {
        securityGroups: [loadBalancerSecurityGroup.id],
        subnets: publicSubnets,
        enableDeletionProtection: false, // Set to true if needed
    },{dependsOn:[loadBalancerSecurityGroup,publicSubnets]});
    

    //create http target group to application port
    const httpTargetGroup = new aws.lb.TargetGroup("httpTargetGroup", {
        port: applnPort,
        protocol: http_protocol,
        targetType: "instance",
        vpcId: vpc.id,
        healthCheck: {
            enabled: true,        // Checkbox to control the health check
            unhealthyThreshold: 2, // The number of consecutive checks failures
            healthyThreshold: 3,   // The number of consecutive passes for it to be declared as healthy
            interval: 30,          // Duration in seconds in between individual health checks
            timeout: 5,            // The duration after which the check times out, in seconds
            path: api_testing, 
            port: applnPort,             // The destination for the health check request
            protocol:http_protocol,        // Set the same protocol as the target group
        },
    })
    

    // Setting up the listener for the HTTP target group.
    const httpListener = new aws.lb.Listener("httpListener", {
        loadBalancerArn: loadBalancer.arn,
        port: httpPort,
        defaultActions: [{
            type: "forward",
            targetGroupArn: httpTargetGroup.arn
        }],
    });


    //user data script base64 conversion
    //const userData = Buffer.from(userDataScript).toString('base64');

    const launch_template = new aws.ec2.LaunchTemplate("launch_template", {
        imageId: ami_id, 
        instanceType: instanceType,  
        iamInstanceProfile: {
            arn: instanceProfile.arn
        },
        keyName: keyPair.keyName,
        networkInterfaces: [{
            associatePublicIpAddress: true,
            securityGroups: [applicationSecurityGroup.id]
        }],
        blockDeviceMappings: [{
            deviceName: device_path,
            ebs: {
                volumeSize: volumeSize,
                volumeType: volumeType,
                deleteOnTermination: true,
            },
        }],
        tagSpecifications: [{
            resourceType: "instance",
            tags: {
                Name: "Launch-Template"
            }
        }],
        userData: encodedUserData,
    }, {dependsOn: [rdsinstance, applicationSecurityGroup, instanceProfile, sns]});

    // Define an auto-scaling group which constrains its instances with the launch configuration
    const autoScalingGroup = new aws.autoscaling.Group("web-autoscaling-group", {
        desiredCapacity: 1,
        maxSize: 3,
        minSize: 1,
        launchTemplate: {
            id: launch_template.id,
            version: launch_template.latestVersion
        },
        targetGroupArns: [httpTargetGroup.arn],
        loadBalancer: [loadBalancer.arn],
        vpcZoneIdentifiers: publicSubnets,
        tags: [{
            key: "Name",
            value: "asg_launch_config",
            propagateAtLaunch: true,
        }],
    }, { dependsOn: [httpTargetGroup,applicationSecurityGroup, rdsinstance, launch_template, loadBalancer] });
    


    const asgStepPolicyUp = new aws.autoscaling.Policy("asgStepPolicyUp", {
        scalingAdjustment: 1,
        adjustmentType: "ChangeInCapacity",
        cooldown: cooldown_time,
        // estimatedInstanceWarmup: 300,
        autoscalingGroupName: autoScalingGroup.name,
        // metricAggregationType: "sum",
        policyType: policyType_val,
    })
    
    const asgStepPolicyDown = new aws.autoscaling.Policy("asgStepPolicyDown", {
        scalingAdjustment: -1,
        adjustmentType: "ChangeInCapacity",
        cooldown: cooldown_time,
        // estimatedInstanceWarmup: 300,
        autoscalingGroupName: autoScalingGroup.name,
        // metricAggregationType: "Sum",
        policyType: policyType_val,
    })

    // #region CloudWatch Alarms
    const scaleUpAlarm = new aws.cloudwatch.MetricAlarm("scale-up-alarm", {

        alarmName: "ScaleUpAlarm",
        comparisonOperator: "GreaterThanThreshold",
        evaluationPeriods: 1,
        threshold: threshold,
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: 60,
        statistic: statistic,
        dimensions: {
            AutoScalingGroupName: autoScalingGroup.name,
        },
        alarmActions: [asgStepPolicyUp.arn],
    },{dependsOn:[autoScalingGroup,asgStepPolicyUp]});
    
    const scaleDownAlarm = new aws.cloudwatch.MetricAlarm("scale-down-alarm", {
        alarmName: "ScaleDownAlarm",
        comparisonOperator: "LessThanThreshold",
        evaluationPeriods: 1,
        threshold: threshold,
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: 60,
        statistic: statistic,
        dimensions: {
            AutoScalingGroupName: autoScalingGroup.name,
        },
        alarmActions: [asgStepPolicyDown.arn],
    },{dependsOn:[autoScalingGroup,asgStepPolicyDown]});
    
    
    //create ec2 instance
   /* const ec2Instance = new aws.ec2.Instance("my-ec2-instance", {
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
            role: role.name,
            iamInstanceProfile: instanceProfile,
            tags: {
                Name: "Abhishek-EC2Instance", // Replace with a suitable name
            },
    }, {dependsOn: [rdsinstance,dbSecurityGroup, role, instanceProfile, cloudWatchFullAccess ]});*/

    // Get an existing Hosted Zone using its Zone ID
    const myZone = aws.route53.getZone({ zoneId: hostedZone });   

    // Create or update an A record to point to the public IP addres of the EC2 instance
    const myRecord = new aws.route53.Record("myRecord", {
        name: domainname,
        type: "A",
        zoneId: hostedZone,
        aliases: [
            {
                name: loadBalancer.dnsName,
                zoneId: loadBalancer.zoneId,
                evaluateTargetHealth: true,
            },
        ],
    }, { 
        dependsOn: [loadBalancer, autoScalingGroup] 
    });


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

