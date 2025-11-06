@echo off
rem Licensed to the Apache Software Foundation (ASF) under one or more
rem contributor license agreements.  See the NOTICE file distributed with
rem this work for additional information regarding copyright ownership.
rem The ASF licenses this file to You under the Apache License, Version 2.0
rem (the "License"); you may not use this file except in compliance with
rem the License.  You may obtain a copy of the License at
rem
rem     http://www.apache.org/licenses/LICENSE-2.0
rem
rem Unless required by applicable law or agreed to in writing, software
rem distributed under the License is distributed on an "AS IS" BASIS,
rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
rem See the License for the specific language governing permissions and
rem limitations under the License.

setlocal enabledelayedexpansion

IF [%1] EQU [] (
	echo USAGE: %0 classname [opts]
	EXIT /B 1
)

rem Using pushd popd to set BASE_DIR to the absolute path
pushd %~dp0..\..
set BASE_DIR=%CD%
popd

IF ["%SCALA_VERSION%"] EQU [""] (
  set SCALA_VERSION=2.13.16
)

IF ["%SCALA_BINARY_VERSION%"] EQU [""] (
  for /f "tokens=1,2 delims=." %%a in ("%SCALA_VERSION%") do (
    set FIRST=%%a
    set SECOND=%%b
    if ["!SECOND!"] EQU [""] (
      set SCALA_BINARY_VERSION=!FIRST!
    ) else (
      set SCALA_BINARY_VERSION=!FIRST!.!SECOND!
    )
  )
)

@REM rem Classpath addition for kafka-core dependencies
@REM for %%i in ("%BASE_DIR%\core\build\dependant-libs-%SCALA_VERSION%\*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for kafka-examples
@REM for %%i in ("%BASE_DIR%\examples\build\libs\kafka-examples*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for kafka-clients
@REM for %%i in ("%BASE_DIR%\clients\build\libs\kafka-clients*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for kafka-streams
@REM for %%i in ("%BASE_DIR%\streams\build\libs\kafka-streams*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for kafka-streams-examples
@REM for %%i in ("%BASE_DIR%\streams\examples\build\libs\kafka-streams-examples*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM for %%i in ("%BASE_DIR%\streams\build\dependant-libs-%SCALA_VERSION%\rocksdb*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for kafka tools
@REM for %%i in ("%BASE_DIR%\tools\build\libs\kafka-tools*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM for %%i in ("%BASE_DIR%\tools\build\dependant-libs-%SCALA_VERSION%\*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM for %%p in (api runtime file json tools) do (
@REM 	for %%i in ("%BASE_DIR%\connect\%%p\build\libs\connect-%%p*.jar") do (
@REM 		call :concat "%%i"
@REM 	)
@REM 	if exist "%BASE_DIR%\connect\%%p\build\dependant-libs\*" (
@REM 		call :concat "%BASE_DIR%\connect\%%p\build\dependant-libs\*"
@REM 	)
@REM )

@REM rem Classpath addition for release
@REM for %%i in ("%BASE_DIR%\libs\*") do (
@REM 	call :concat "%%i"
@REM )

@REM rem Classpath addition for core
@REM for %%i in ("%BASE_DIR%\core\build\libs\kafka_%SCALA_BINARY_VERSION%*.jar") do (
@REM 	call :concat "%%i"
@REM )

@REM rem JMX settings
@REM IF ["%KAFKA_JMX_OPTS%"] EQU [""] (
@REM 	set KAFKA_JMX_OPTS=-Dcom.sun.management.jmxremote -Dcom.sun.management.jmxremote.authenticate=false  -Dcom.sun.management.jmxremote.ssl=false
@REM )

@REM rem JMX port to use
@REM IF ["%JMX_PORT%"] NEQ [""] (
@REM 	set KAFKA_JMX_OPTS=%KAFKA_JMX_OPTS% -Dcom.sun.management.jmxremote.port=%JMX_PORT%
@REM )

@REM rem Log directory to use
@REM IF ["%LOG_DIR%"] EQU [""] (
@REM     set LOG_DIR=%BASE_DIR%/logs
@REM )

@REM rem Log4j settings
@REM IF ["%KAFKA_LOG4J_OPTS%"] EQU [""] (
@REM 	set KAFKA_LOG4J_OPTS=-Dlog4j2.configurationFile=file:%BASE_DIR%/config/tools-log4j2.yaml
@REM ) ELSE (
@REM     rem Check if Log4j 1.x configuration options are present in KAFKA_LOG4J_OPTS
@REM     echo %KAFKA_LOG4J_OPTS% | findstr /r /c:"log4j\.[^ ]*(\.properties|\.xml)$" >nul
@REM     IF %ERRORLEVEL% == 0 (
@REM         rem Enable Log4j 1.x configuration compatibility mode for Log4j 2
@REM         set LOG4J_COMPATIBILITY=true
@REM         echo DEPRECATED: A Log4j 1.x configuration file has been detected, which is no longer recommended. >&2
@REM         echo To use a Log4j 2.x configuration, please see https://logging.apache.org/log4j/2.x/migrate-from-log4j1.html#Log4j2ConfigurationFormat for details about Log4j configuration file migration. >&2
@REM         echo You can also use the %BASE_DIR%/config/tool-log4j2.yaml file as a starting point. Make sure to remove the Log4j 1.x configuration after completing the migration. >&2
@REM     )
@REM   rem create logs directory
@REM   IF not exist "%LOG_DIR%" (
@REM       mkdir "%LOG_DIR%"
@REM   )
@REM )

@REM set KAFKA_LOG4J_OPTS=-Dkafka.logs.dir="%LOG_DIR%" "%KAFKA_LOG4J_OPTS%"

@REM rem Generic jvm settings you want to add
@REM IF ["%KAFKA_OPTS%"] EQU [""] (
@REM 	set KAFKA_OPTS=
@REM )

@REM set DEFAULT_JAVA_DEBUG_PORT=5005
@REM set DEFAULT_DEBUG_SUSPEND_FLAG=n
@REM rem Set Debug options if enabled
@REM IF ["%KAFKA_DEBUG%"] NEQ [""] (


@REM 	IF ["%JAVA_DEBUG_PORT%"] EQU [""] (
@REM 		set JAVA_DEBUG_PORT=%DEFAULT_JAVA_DEBUG_PORT%
@REM 	)

@REM 	IF ["%DEBUG_SUSPEND_FLAG%"] EQU [""] (
@REM 		set DEBUG_SUSPEND_FLAG=%DEFAULT_DEBUG_SUSPEND_FLAG%
@REM 	)
@REM 	set DEFAULT_JAVA_DEBUG_OPTS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=!DEBUG_SUSPEND_FLAG!,address=!JAVA_DEBUG_PORT!

@REM 	IF ["%JAVA_DEBUG_OPTS%"] EQU [""] (
@REM 		set JAVA_DEBUG_OPTS=!DEFAULT_JAVA_DEBUG_OPTS!
@REM 	)

@REM 	echo Enabling Java debug options: !JAVA_DEBUG_OPTS!
@REM 	set KAFKA_OPTS=!JAVA_DEBUG_OPTS! !KAFKA_OPTS!
@REM )

@REM rem Which java to use
@REM IF ["%JAVA_HOME%"] EQU [""] (
@REM 	set JAVA=java
@REM ) ELSE (
@REM 	set JAVA="%JAVA_HOME%/bin/java"
@REM )

@REM rem Memory options
@REM IF ["%KAFKA_HEAP_OPTS%"] EQU [""] (
@REM 	set KAFKA_HEAP_OPTS=-Xmx256M
@REM )

@REM rem JVM performance options
@REM IF ["%KAFKA_JVM_PERFORMANCE_OPTS%"] EQU [""] (
@REM 	set KAFKA_JVM_PERFORMANCE_OPTS=-server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -Djava.awt.headless=true
@REM )

@REM IF not defined CLASSPATH (
@REM 	echo Classpath is empty. Please build the project first e.g. by running 'gradlew jarAll'
@REM 	EXIT /B 2
@REM )

@REM set COMMAND=%JAVA% %KAFKA_HEAP_OPTS% %KAFKA_JVM_PERFORMANCE_OPTS% %KAFKA_JMX_OPTS% %KAFKA_LOG4J_OPTS% -cp "%CLASSPATH%" %KAFKA_OPTS% %*
@REM rem echo.
@REM rem echo %COMMAND%
@REM rem echo.
@REM %COMMAND%

@REM goto :eof
@REM :concat
@REM IF not defined CLASSPATH (
@REM   set CLASSPATH="%~1"
@REM ) ELSE (
@REM   set CLASSPATH=%CLASSPATH%;"%~1"
@REM )

rem ==== BEGIN: short classpath to avoid long command line on Windows ====
set CLASSPATH=
set CLASSPATH=%BASE_DIR%\config;%BASE_DIR%\libs\*
rem ==== END ====