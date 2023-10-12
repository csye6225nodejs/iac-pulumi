const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

const { createVPC, createSubnets } = require("./vpc");
const  destinationCidr = new pulumi.Config("iac-pulumi").require("destinationCidr");


function createInternetGateway(vpc) {
    const internetGateway = new aws.ec2.InternetGateway("my-igw", {
        tags: {
            Name: 'Internet-Gateway', // Your custom name for the Internet Gateway
        }
    });

    return internetGateway;
}

function createPublicRouteTable(vpc, publicSubnets, internetGateway) {

    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
        vpcId: vpc.id,
    });

    new aws.ec2.Route("public-route", {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: destinationCidr,
        gatewayId: internetGateway.id,
    });

    publicSubnets.forEach((subnet, index) => {

        new aws.ec2.RouteTableAssociation(`public-rt-assoc-${index}`, {
            subnetId: subnet.id,
            routeTableId: publicRouteTable.id,
        });
    });

    return publicRouteTable;
}

function createPrivateRouteTable(vpc, privateSubnets) {
    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
        vpcId: vpc.id,
    });

    privateSubnets.forEach((subnet, index) => {
        new aws.ec2.RouteTableAssociation(`private-rt-assoc-${index}`, {
            subnetId: subnet.id,
            routeTableId: privateRouteTable.id,
        });
    });

    return privateRouteTable;
}

module.exports = {
    createInternetGateway,
    createPublicRouteTable,
    createPrivateRouteTable,
};
