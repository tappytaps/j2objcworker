#!/usr/bin/env node
const J2OBJC_WAIT_FOR_MORE_FILES_TIMEOUT = 2000
const CUSTOM_SCRIPT_WHEN_CHANGE_TIMEOUT  = 4000

async function startJ2ObjcWatcher() {
    const chokidar = require('chokidar')
    const exec = require('child_process').exec
    const path = require('path')
    const chalk = require('chalk')
    const TaskProcessor = require("./js/taskprocessor")
    const fs = require('fs-extra')
    const commander = require('commander')

    const taskProcessor = new TaskProcessor(J2OBJC_WAIT_FOR_MORE_FILES_TIMEOUT)
    const needRebuildProcessor = new TaskProcessor(CUSTOM_SCRIPT_WHEN_CHANGE_TIMEOUT)

    // command line arguments
    commander
        .description('J2Objc automatic java watcher and converter. With no arguments reads config from j2objc.json.')
        .usage('[options]')
        .option('-b, --batchmode', 'Process all files and then exits (otherwise interactive mode is started)')
        .option('-c, --config <jsonfile>', 'JSON file with configuration (default j2objc.json in current directory)')
        .option('--changescript <script>', 'Script, that is executed when file was added / removed (for example call pod install on main project')
        .option('--verbose', "Show more debug information")
        .parse(process.argv)

    let configuration = {}
    const j2objcHome = process.env["J2OBJC_HOME"]
    if (!j2objcHome) {
        console.log(chalk.red("Please define J2OBJC_HOME"))
        commander.help()
    } else {
        if (commander.verbose) {
            console.log(`Using j2Objc from ${j2objcHome}`)
        }
        
    }

    try {
        let configFile = commander.config ? path.resolve(commander.config) : path.join(process.cwd(),"j2objc.json")
        configuration = require(configFile)
    } catch(exeption) {
        console.log(chalk.red("No j2objc.json exists in current directory!"))
        commander.help()
    }

    const {otheroptions = "", classpath = "", prefix, javasources = [], objcdir = ""} = configuration
    if (classpath.length == 0) {
        console.log(chalk.red("Item 'classpath' has to be defined in j2objc.json"))
        commander.help()
    }
    if (javasources.length == 0) {
        console.log(chalk.red("At least one 'javasources' has to be defined in j2objc.json"));
        commander.help()
    }
    if (objcdir.length == 0) {
        console.log(chalk.red("Item 'objcdir' that specifies output directory has to be defined in j2objc.json"));
        commander.help()
    }

    // only java sources
    const fixedJavaSources = javasources.map(item => path.resolve(item) + "/**/*.java")
    const javaSourcesDirInOne = javasources.reduce((output, item) => output + path.resolve(item) + ":", "")
    const otherOptions = configuration.otheroptions
    if (commander.verbose) {
        console.log("Starting to watch folders: " + JSON.stringify(configuration.javasources))
    }

    // need rebuild processor
    needRebuildProcessor.processQueue = () => {
        var command = commander.changescript
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
                    return;
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

    // calling j2objc to process new files
    taskProcessor.processQueue = (listOfFiles) => {
        needRebuildProcessor.pause()
        taskProcessor.pause()
        let files = listOfFiles.reduce((allFiles, item) => allFiles + " " + item)
        if (commander.verbose) {
            console.log("Processing files: ", JSON.stringify(files))
        }
        if (listOfFiles.length > 3) {
            process.stdout.write("* Processing "+ chalk.bold(listOfFiles.length) + " Java file(s)... ")
        } else {
            let filesToShow = listOfFiles.map(item => path.basename(item))
            process.stdout.write("* Processing: " + chalk.bold(filesToShow.join(", ")) + "... ")
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
            } else {         
                if (stdout.length > 0) {
                    console.log(chalk.gray(`${stdout}`));
                }                
                if (commander.verbose) {
                    console.log("j2objc run finished.")
                }                
            }
            taskProcessor.resume()
            needRebuildProcessor.resume()
            // when in batch mode, exit after first processing
            if (commander.batchmode) {
                process.exit(0)
            }           
        })
    }

    // remove old output dir - we will regenerate everything in first call
    console.log("* Initializing " + chalk.bold(objcdir))
    await fs.remove(objcdir)

    chokidar.watch(fixedJavaSources).on("all", (event, path) => {
        // anoteher check if java - looks like that some .directories
        // go through chokidar.watch even when *.java is specified
        if (!path.toLowerCase().endsWith(".java")) {
            return
        }
        if (commander.verbose) {
            console.log(`Adding file to queue ${path}`)
            console.log("Event: ", event)    
        }
        if (event == "add" || event == "change") {
            taskProcessor.addFile(path)
        }        
        if (event == "add" || event == "unlink") {
            needRebuildProcessor.addFile(path)
        }
    });
}

startJ2ObjcWatcher()