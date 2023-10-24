const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const index = require('./index');

async function createRdsInstance(dbSecurityGroup, subnetIdArray) {


    // Database configuration
    const dbIdentifier = 'csye6225';
    const dbName = 'csye6225';
    const dbUsername = 'csye6225';
    const dbPassword = 'Abhi$3534';

    const dbSubnetGroup = new aws.rds.SubnetGroup("db_subnet_group", {
        subnetIds: subnetIdArray,
    });

    const rdsInstance = new aws.rds.Instance(dbIdentifier, {
        // Database configuration
        allocatedStorage: 20,
        instanceClass: 'db.t2.micro',
        dbName: dbName,
        username: dbUsername,
        password: dbPassword,

        // General configuration
        publiclyAccessible: false,
        vpcSecurityGroupIds: [dbSecurityGroup.id],
        dbSubnetGroupName: dbSubnetGroup.name,

        // Engine configuration
        engine: 'mysql',
        engineVersion: '5.7',
        multiAz: false,
        parameterGroupName: 'default.mysql5.7',
        skipFinalSnapshot: true,
        applyImmediately: true
    });

    return {
        rdsInstance: rdsInstance
    };
}

module.exports = {createRdsInstance};
