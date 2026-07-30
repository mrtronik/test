const ServerService = require('./ServerService');
const ServiceManager = require('./ServiceManager');

class DashboardService {

    static async get() {

        return {

            server: {

                hostname: ServerService.hostname(),

                platform: ServerService.platform(),

                cpu: ServerService.cpu(),

                ram: ServerService.ram(),

                disk: await ServerService.disk(),

                uptime: ServerService.uptime()

            },

            services: {

                ols: await ServiceManager.status('lsws'),

                mariadb: await ServiceManager.status('mariadb'),

                redis: await ServiceManager.status('redis-server'),

                docker: await ServiceManager.status('docker')

            }

        };

    }

}

module.exports = DashboardService;