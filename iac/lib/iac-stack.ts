import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class IacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get the default VPC
    const defaultVpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true,
    });

    // Replace with your SSH key name
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      publicKeyMaterial: process.env.PUBLIC_SSH_KEY,
    })

    // User provided user data
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo apt update',
      'sudo apt upgrade -y',
      'sudo apt install -y docker.io curl git',
      'sudo usermod -a -G docker ubuntu',
      'exit'
    );

    // Create an IAM role for the EC2 instance
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Add SSM GetParameter policy to the role
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: ["*"],
      })
    );

    // Add CloudWatch logging policy
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:PutLogEvents',
          'logs:PutRetentionPolicy',
          'logs:DescribeLogStreams',
          'logs:DescribeLogGroups',
          'logs:CreateLogStream',
          'logs:CreateLogGroup',
        ],
        resources: ['*']
      })
    );

    // Create EC2 instance
    const instance = new ec2.Instance(this, 'Laravel-Kamal', {
      vpc: defaultVpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.fromSsmParameter(
          '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id',
          {
            os: ec2.OperatingSystemType.LINUX,
          }
      ), // Ubuntu 24.04
      keyPair: keyPair,
      userData: userData,
      securityGroup: new ec2.SecurityGroup(this, 'InstanceSG', {
          vpc: defaultVpc,
          allowAllOutbound: true,
      }),
      role: instanceRole
    });

    // Allow needed traffic to access ports
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(22), 'Allow SSH access');
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP traffic');
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(443), 'Allow HTTPS traffic');

    // Output the public IP address
    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: instance.instancePublicIp,
      description: 'EC2 Instance Public IP Address',
    });
  }
}
