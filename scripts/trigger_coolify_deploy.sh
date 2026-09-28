#!/bin/bash
set -e

cat << 'EOF' > /tmp/deploy.php
<?php
require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$application = App\Models\Application::where('uuid', 'o58s2caega68fkuxpff0pubf')->first();
if ($application) {
    $deployment_uuid = (string) Illuminate\Support\Str::uuid();
    queue_application_deployment(
        application: $application,
        deployment_uuid: $deployment_uuid,
        force_rebuild: true
    );
    echo "SUCCESS: Deployment queued with UUID: " . $deployment_uuid . "\n";
} else {
    echo "ERROR: Application not found\n";
}
EOF

sudo docker cp /tmp/deploy.php coolify:/var/www/html/deploy.php
sudo docker exec coolify php /var/www/html/deploy.php
sudo docker exec coolify rm /var/www/html/deploy.php
rm -f /tmp/deploy.php
