#!/usr/bin/env node
const PROTO_WAIT_FOR_MORE_FILES_TIMEOUT = 1000
const J2OBJC_WAIT_FOR_MORE_FILES_TIMEOUT = 1200
const CUSTOM_SCRIPT_WHEN_CHANGE_TIMEOUT  = 4000

async function startJ2ObjcWatcher() {
    const chokidar = require('chokidar')
    const { exec } = require('child_process')
    const path = require('path')
    const chalk = require('chalk')
    const TaskProcessor = require("./js/taskprocessor")
    const fs = require('fs-extra')
    const commander = require('commander')
    const FileHound = require('filehound')
    const replace = require('replace-in-file');

    const javaTaskProcessor = new TaskProcessor(J2OBJC_WAIT_FOR_MORE_FILES_TIMEOUT)
    const protoTaskProcessor = new TaskProcessor(PROTO_WAIT_FOR_MORE_FILES_TIMEOUT)
    const needRebuildProcessor = new TaskProcessor(CUSTOM_SCRIPT_WHEN_CHANGE_TIMEOUT)
    
    const FileTypes = {
        UNKNOWN: "unknown",
        JAVA: "java", 
        PROTO: "proto"
    }

    // command line arguments
    commander
        .description('J2Objc automatic java watcher and converter. With no arguments reads config from j2objc.json.')
        .usage('[options]')
        .option('-b, --batchmode', 'Process all files and then exit (otherwise interactive mode is started)')
        .option('-c, --config <jsonfile>', 'JSON file with configuration (default j2objc.json in current directory)')
        .option('--changescript <script>', 'Script, that is executed when file was added / removed (for example call pod install on main project)')
        .option('--experimantalremove', 'Enable experimental remove function - removes *.h and *.m when related .java removed (experimental)')
        .option('--verbose', "Show more debug information")
        .parse(process.argv)

    let configuration = {}
    const j2objcHome = process.env.J2OBJC_HOME
    if (!j2objcHome) {
        console.log(chalk.red("Please define J2OBJC_HOME"))
        commander.help()
    } else if (commander.verbose) {
        console.log(`Using j2Objc from ${j2objcHome}`)
    }

    try {
        const configFile = commander.config ? path.resolve(commander.config) : path.join(process.cwd(),"j2objc.json")
        configuration = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch(exeption) {
        console.log(chalk.red("No j2objc.json exists in current directory!"))
        commander.help()
    }

    const {
        otheroptions = "", 
        classpath, 
        prefix, 
        javasources = [], 
        objcdir, 
        experimentalremove = commander.experimentalremove,
        protobufdir,
    } = configuration

    const absProtobufDir = path.resolve(protobufdir)
    
    if (!classpath) {
        console.log(chalk.red("Item 'classpath' has to be defined in j2objc.json"))
        commander.help()
    }
    if (javasources.length === 0) {
        console.log(chalk.red("At least one 'javasources' has to be defined in j2objc.json"));
        commander.help()
    }
    if (!objcdir) {
        console.log(chalk.red("Item 'objcdir' that specifies output directory has to be defined in j2objc.json"));
        commander.help()
    }

    // only java sources
    const fixedJavaSources = javasources.map(item => `${path.resolve(item)}/**/*`)
    const javaSourcesDirInOne = javasources.reduce((output, item) => `${output + path.resolve(item)}:`, "")
    if (commander.verbose) {
        console.log(`Starting to watch folders: ${JSON.stringify(configuration.javasources)}`)
    }

    // need rebuild processor
    needRebuildProcessor.processQueue = () => {
        let command = commander.changescript
        if (!command) {
            command = configuration.changescript
        }
        if (commander.verbose) {
            console.log("Starting change script")
        }        
        
        if (command) {
            console.log(chalk.blueBright(command))
            exec(path.resolve(command), (err, stdout, stderr) => {
                if (err) {
                    console.error(chalk.red(`change script exec error: ${err}`));                    
                } else {
                    if (stdout.length > 0) {
                        console.log(chalk.gray(`${stdout}`));
                    }                    
                    if (command.verbose) {
                        console.log("change script run finished.")
                    }                    
                }
            })
        } else {
            console.log(chalk.yellow("* new file(s) were added / removed. Consider update main project."))            
        }
    }

    // calling to process proto files
    protoTaskProcessor.processQueue = (listOfFiles) => {
        // is protobuf configured?
        if (protobufdir === null) {
            console.log(chalk.red("Cannot process .proto - protobufdir is not set in config file."))
        } else {
            needRebuildProcessor.pause()
            javaTaskProcessor.pause()
            if (commander.verbose) {
                console.log(`Proto process: ${listOfFiles}`);            
            }
            const filesToShow = listOfFiles.map(item => path.basename(item))
            process.stdout.write(`* Processing: ${chalk.bold(filesToShow.join(", "))}... `)

            listOfFiles.forEach(fileName => {
                const protoCCommand = `${j2objcHome}/j2objc_protoc  --proto_path=${absProtobufDir}/src --java_out ${absProtobufDir}/genjava --j2objc_out=${absProtobufDir}/genobjc ${fileName}`
                if (commander.verbose) {
                    console.log(protoCCommand)
                }
                // create Java & objc protobuffers
                exec(protoCCommand, async (err, stdout, stderr) => {
                    if (err) {
                        console.error(chalk.bold.red(`j2objc_protoc exec error: ${err}`));
                        javaTaskProcessor.resume()
                        needRebuildProcessor.resume()                
                        return;
                    }          
                    if (stdout.length > 0) {
                        console.log(chalk.gray(`${stdout}`));
                    }
//                    fix generated protobuf outputs to use "flat" includes
                    const files = await FileHound.create()
                        .paths(`${absProtobufDir}/genobjc`)
                        .ext("m")
                        .find()
                    for (const file of files) {
                        console.log(file)
                        try {
                            const baseName = path.basename(file, ".m");
                            console.log(`Base name ${baseName}`)
                            const changes = await replace({
                                files: file,
                                from: (tmpName) => new RegExp(`#import .*(${baseName}).*`, 'g'),                                
                                to: (match) => `#import "${baseName}.h"`
                            })
                            console.log('Modified files:', changes.join(', '));
                        }
                        catch (error) {
                            console.error('Error occurred:', error);
                        }    
                    }
                    
                        

                    // compile Java
                    const javaCCommand = `javac -cp ${j2objcHome}/lib/protobuf_runtime.jar -d ${absProtobufDir}/classes \`find ${absProtobufDir}/genjava -name "*.java"\``
                    if (commander.verbose) {
                        console.log(javaCCommand)
                    }
                    exec(javaCCommand, (err2, stdout2, stderr2) => {
                        process.stdout.write(chalk.green("Done\n"))

                        javaTaskProcessor.resume()
                        needRebuildProcessor.resume()                

                        if (err) {
                            console.error(chalk.bold.red(`javac exec error: ${err2}`));
                            return;
                        }          
                        if (stdout2.length > 0) {
                            console.log(chalk.gray(`${stdout}`));
                        }    
                    })
                })
            });

        }
    }

    // calling j2objc to process new files
    javaTaskProcessor.processQueue = (listOfFiles) => {
        needRebuildProcessor.pause()
        javaTaskProcessor.pause()
        const files = listOfFiles.reduce((allFiles, item) => `${allFiles} ${item}`)
        if (commander.verbose) {
            console.log("Processing files: ", JSON.stringify(files))
        }
        if (listOfFiles.length > 3) {
            process.stdout.write(`* Processing ${chalk.bold(listOfFiles.length)} Java file(s)... `)
        } else {
            const filesToShow = listOfFiles.map(item => path.basename(item))
            process.stdout.write(`* Processing: ${chalk.bold(filesToShow.join(", "))}... `)
        }
        let j2ObjcExec = `${j2objcHome}/j2objc -d "${configuration.objcdir}" -sourcepath "${javaSourcesDirInOne}" -classpath "${classpath}" ${otheroptions}`
        if (prefix) {
            j2ObjcExec += ` --prefix "${prefix}"`
        }
        j2ObjcExec += ` ${files}`
        exec(j2ObjcExec, (err, stdout, stderr) => {
            process.stdout.write(chalk.green("Done\n"))
            if (err) {
                console.error(chalk.bold.red(`exec error: ${err}`));
                return;
            }          
            if (stdout.length > 0) {
                console.log(chalk.gray(`${stdout}`));
            }                
            if (commander.verbose) {
                console.log("j2objc run finished.")
            }                
            
            javaTaskProcessor.resume()
            needRebuildProcessor.resume()
            // when in batch mode, exit after first processing
            if (commander.batchmode) {
                process.exit(0)
            }           
        })
    }

    // remove old output dir - we will regenerate everything in first call
    console.log(`* Initializing ${chalk.bold(objcdir)}`)
    await fs.remove(objcdir)
    await fs.remove(`${absProtobufDir}/gen`)
    await fs.mkdir(`${absProtobufDir}/gen`)
    await fs.remove(`${absProtobufDir}/genobjc`)
    await fs.mkdir(`${absProtobufDir}/genobjc`)
    await fs.remove(`${absProtobufDir}/genjava`)
    await fs.mkdir(`${absProtobufDir}/genjava`)
    await fs.remove(`${absProtobufDir}/classes`)
    await fs.mkdir(`${absProtobufDir}/classes`)
    

    chokidar.watch(fixedJavaSources).on("all", async (event, pathWithFile) => {
        // anoteher check if java - looks like that some .directories
        // go through chokidar.watch even when *.java is specified
        // also handle some special cases, like when xcode uses temporary files with ~
        if (pathWithFile.indexOf("~.") >= 0) {
            return
        }

        let fileType = FileTypes.UNKNOWN
        if (pathWithFile.endsWith(".java")) {
            fileType = FileTypes.JAVA
        } else if (pathWithFile.endsWith(".proto")) {
            fileType = FileTypes.PROTO
        }
        // no supported file type
        if (fileType === FileTypes.UNKNOWN) {
            return
        }

        if (commander.verbose) {
            console.log(`Adding file to queue ${pathWithFile} (${fileType}`)
            console.log("Event: ", event)    
        }
        if (event === "add" || event === "change") {
            if (fileType === FileTypes.JAVA) {
                javaTaskProcessor.addFile(pathWithFile)
            } else if (fileType === FileTypes.PROTO) {
                protoTaskProcessor.addFile(pathWithFile)
            }
            
        }        
        if (event === "add" || event === "unlink") {
            needRebuildProcessor.addFile(pathWithFile)
        }
        if (event === "unlink" && experimentalremove) {
            if (fileType === FileTypes.JAVA) {
                const destFile = path.join(path.resolve(objcdir), path.basename(pathWithFile, ".java"))
                console.log("* removed ", chalk.bold(`${destFile}.*`),".")
                await fs.unlink(`${destFile}.m`)
                await fs.unlink(`${destFile}.h`)    
            }
        }
    });
}

startJ2ObjcWatcher()