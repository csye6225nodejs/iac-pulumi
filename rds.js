/******************************** */
/*
// Example usage:
const vpcId = '<Your-VPC-ID>'; // replace with your VPC ID
const subnetIdArray = ['<Your-Subnet-ID-1>', '<Your-Subnet-ID-2>']; // replace with your subnet IDs

const { rdsAddress } = createRdsInstance(vpcId, subnetIdArray, dbIdentifier, dbName, dbUsername, dbPassword);

// Export the RDS instance address
exports.rdsAddress = rdsAddress;

*/

/***************************** */

const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const index = require('./index');

async function createRdsInstance(vpc, subnetIdArray) {


    // Database configuration
    const dbIdentifier = 'csye6225';
    const dbName = 'csye6225';
    const dbUsername = 'csye6225';
    const dbPassword = 'Abhi\$3534';

    const rdsInstance = new aws.rds.Instance(dbIdentifier, {
        // Database configuration
        allocatedStorage: 20,
        instanceClass: 'db.t2.micro',
        name: dbName,
        username: dbUsername,
        password: dbPassword,

        // General configuration
        publiclyAccessible: false,
        vpcSecurityGroupIds: [vpc.id],
        dbSubnetGroupName: subnetIdArray.join(','),

        // Engine configuration
        engine: 'mysql',
        engineVersion: '5.7',
        multiAz: false,
        parameterGroupName: 'default.mysql5.7',
        skipFinalSnapshot: true,
        applyImmediately: true
    });

    return {
        rdsAddress: rdsInstance.address
    };
}

module.exports = {createRdsInstance};
