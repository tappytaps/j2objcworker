# J2ObjC Worker
The J2Objc worker is the tool to simplify development using [J2ObjC](https://developers.google.com/j2objc/). 

Both ways, how to integrate Java sources with iOS project described on J2ObjC site have downsides - and are good enough for projects, that have already stable Java backend and the iOS app is only using it. However this is not how we work in our company - we develop common Java backend and iOS frontend simultaneously. Therefore we usually change both Java part and iOS (Swift part) every day.

We needed fast and easy integration, ideally compatible with CocoaPods. That was reason to create J2ObjC Worker.

## How it works
This tool is highly inspired by [nodemon](http://nodemon.io) and other similar tools, that do one simple thing - watch specific files and when they change, do something. In case of J2ObjC Worker, it calls J2ObjC tool.

From our experience, when we want to use CocoaPods integration, it is best to work with generated J2Objc sources. It is much better, that use the static library because we don't lose debugging of Java sources. Also compiling Java sources during build process using custom build rule doesn't work always correctly, broke autocomplete in Xcode or so.

The idea is to monitor all common sources in Java project (that is usually used in Android as well) and transcript them to Objective-C when needed. The simple .podspec then include those sources and Cocoapods integrate them into the main project. We are using this Java as Development pod so that it automatically process changes into main Xcode project.

## Installation
Simply run `npm install j2objcworker -g`. It will install command line tool called `j2objcworker`. To run properly, `J2OBJC_HOME` environment variable has to be set.

## Configuration
Per project, the configuration is done in `j2objc.json`. It describes, where to look for Java sources, J2ObjC options and so on. Example of j2objc.json:

```json
{
    "javasources": [
        "3rdparty/squidb/squidb-ios/src",
        "3rdparty/squidb/squidb-annotations/src",
        "iosjava/src",
        "dbmodel",
        "dbimplementation/ios",
        "3rdparty/squidb/squidb/src",
        "src"
    ],
    "objcdir": "./objcfiles",
    "classpath": "${J2OBJC_HOME}/lib/jre_emul.jar:${J2OBJC_HOME}/lib/j2objc_annotations.jar:${J2OBJC_HOME}/lib/javax.inject-1.jar:${J2OBJC_HOME}/lib/jsr305-3.0.0.jar",
    "prefix": "com.tappytaps.fitdog.*=FD",
    "otheroptions": "--swift-friendly -use-arc --nullability --no-package-directories -g",
    "protobufdir": "protobuf"
}
```

### JSON entries
* `javasources` - list of directories with Java sources (required)
* `objcdir` - where to output generated Objective-C files (required)
* `classpath` - classpath parameter used by J2Objc (required)
* `prefix` - package prefix configuration (see more info at [How to specify prefixes for package names] (https://developers.google.com/j2objc/guides/package-prefixes)) (optional)
* `otheroptions` - other options, that are simply passed to J2ObjC (optional)
* `protobufdir` - folder, where to export generated protobuff files

### Protobuff support
Because we are using Protocol Buffers in our apps frequently, we also needed easy way to handle protocol buffer definitions. Therefore tool can also watch for *.proto files and generate
objective-c and java output to folder specified at `protobufdir`. Generated protobuff *.java files are also compiled by javac, as is described at [Objective-C protobuff guide](https://developers.google.com/j2objc/guides/using-protocol-buffers).

## Running
You can start `j2objcworker` without parameters in the directory, where `j2objc.json` is presented. Then it transcribes all *.java files first and then it is switched to monitoring mode. In this mode, it monitors all changes in watched directories and generates new Objective-C sources.

We don't store generated sources in our Git repository - they are just generated sources. So that is the reason, they are regenerated with every run. It takes just a few seconds with hundreds of Java files so that it is not big deal.

You can also use some parameters, `j2objcworker --help` will show them:

```
Usage: j2objcworker [options]

  J2Objc automatic java watcher and converter. With no arguments reads config from j2objc.json.

  Options:

    -b, --batchmode          Process all files and then exit (otherwise interactive mode is started)
    -c, --config <jsonfile>  JSON file with configuration (default j2objc.json in current directory)
    --changescript <script>  Script, that is executed when file was added / removed (for example call pod install on main project)
    --verbose                Show more debug information
    -h, --help               output usage information
```

## Contribution & Bugfixes
I will be glad for your feedback. J2ObjC is complex and there are many ways to use it. Feel free to send me comments, create issues and describe your use cases. This is really the first version of this tool and maybe it can do more.

Contact me at jindra@tappytaps.com.