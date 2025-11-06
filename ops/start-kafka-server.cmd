@echo off
setlocal

rem ==== Kafka 디렉터리(ops 폴더의 한 단계 위에 있는 kafka_2.13-4.1.0를 가리킴)
set "KAFKA_DIR=%~dp0..\kafka_2.13-4.1.0"

rem ==== 사전 점검: JDK
where java >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Java 실행파일이 보이지 않습니다. JAVA_HOME 또는 PATH를 확인하십시오.
  exit /b 1
)

rem ==== 브로커 기동
pushd "%KAFKA_DIR%"
echo [INFO] Using KAFKA_DIR=%CD%
echo [INFO] Starting Kafka with config\server.properties
java -Xmx1G -cp "libs/*;config" kafka.Kafka config\server.properties
set EXITCODE=%ERRORLEVEL%
popd

exit /b %EXITCODE%
