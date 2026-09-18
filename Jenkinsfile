pipeline {
    agent any

    environment {
        PATH = "/Users/chhairin/.nvm/versions/node/v24.14.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

        DATABASE_URL = credentials('household-food-database-url')

        PORT = '10000'
        TEST_BASE_URL = 'http://localhost:10000'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('api') {
                    sh 'npm install'
                }
            }
        }

        stage('Start API') {
            steps {
                dir('api') {
                    sh '''
                        nohup npm start > /tmp/household-food-api.log 2>&1 &
                        echo $! > /tmp/household-food-api.pid
                    '''
                }
            }
        }

        stage('Wait for API') {
            steps {
                sh '''
                    echo "Waiting for API on port 10000..."

                    for i in {1..30}; do
                        if curl -s http://localhost:10000/health > /dev/null; then
                            echo "✅ API is ready!"
                            exit 0
                        fi

                        sleep 1
                    done

                    echo "❌ API failed to start."
                    echo "===== API LOG ====="
                    cat /tmp/household-food-api.log
                    exit 1
                '''
            }
        }

        stage('Test') {
            steps {
                dir('api') {
                    sh 'npm test'
                }
            }
        }
    }

    post {
        always {
            sh '''
                if [ -f /tmp/household-food-api.pid ]; then
                    kill $(cat /tmp/household-food-api.pid) 2>/dev/null || true
                    rm -f /tmp/household-food-api.pid
                fi
            '''
        }
    }
}