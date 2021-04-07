module.exports = {
    apps: [{
        name: 'image_grid',
        script: './bin/www',
        watch: '.',
        "ignore_watch": ["shp"],
        env: {
            NODE_ENV: 'development' //启动默认模式       
        },
        env_production: {
            NODE_ENV: 'production'  //使用production模式},
        }
    }],

    //   deploy : {
    //     production : {
    //       user : 'SSH_USERNAME',
    //       host : 'SSH_HOSTMACHINE',
    //       ref  : 'origin/master',
    //       repo : 'GIT_REPOSITORY',
    //       path : 'DESTINATION_PATH',
    //       'pre-deploy-local': '',
    //       'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
    //       'pre-setup': ''
    //     }
    //   }
};
// chmod +x start.sh
// pm2 reload ecosystem.config.js --env production

