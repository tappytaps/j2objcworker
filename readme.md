# J2ObjC Worker
J2Objc worker is tool to  easy development using [J2ObjC](https://developers.google.com/j2objc/). 

The both ways, how to integrate Java sources with Xcode project described on J2ObjC site has downsides - and mostly are good enough for projects, that has already stable Java backend and the iOS app is only using it. However this is not how we work in our company - we develop common Java backend and iOS frontend in one time. Therefore we usually change both Java part and iOS (Swift part) every day.

We needed to fast and easy integration, ideally compatible with CocoaPods. J2ObjC Worker tool helps with this.

## How it works
This tool is highly inspired with [nodemon](http://nodemon.io) and other similar tools, that do one simple thing - watch specific files and when they change, do something. In case of J2ObjC Worker, it calls J2Objc tool.

From our experience, when we want to use CocoaPods integration, it is best to work with generated J2Objc sources. It is much better, that use static library, because we don't lost debugging of Java sources. Also compiling Java sources during build process using custom build rule doesn't work always correctly, broke intellisense in Xcode or so.

The idea is to monitor all common sources in Java project (that is usually used in Android as well) and transcript them to Objective-C when needed. The simple .podspec then include those sources and Cocoapods integrate them into main project. We are using this Java as Development pod, so that it automatically process changes into main Xcode project.

## Installation
Simply run `npm install j2objcworker -g`. It will install command line tool called `j2objcworker`.

## Configuration
Per project configuration is done in `j2objc.json`. It describes, where to look for Java sources, J2Objc options and so on. Example of j2objc.json:

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
    "otheroptions": "--swift-friendly -use-arc --nullability --no-package-directories -g"
}
```

### JSON entries
* `javasources` - list of directories with Java sources (required)
* `objcdir` - where to output generated Objective-C files (required)
* `classpath` - classpath parameter used by J2Objc (required)
* `prefix` - package prefix configuration (see more info at [How to specify prefixes for package names] (https://developers.google.com/j2objc/guides/package-prefixes)) (optional)
* `otheroptions` - other options, that are simply passed to J2ObjC (optional)

## Running
You can start `j2objcworker` without parameters in directory, where `j2objc.json` is presented. Then it transcribe all *.java files first and than it is switched to monitoring mode. In this mode it monitors all changes in watched directories and generates new Objective-C sources.

We don't store generated sources in our Git repository - they are just generated sources. So that is the reason, they are regenereted with every run. It takes just few seconds with hunderts of Java files, so that no big deal.

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
I will be glad for your feedback. J2ObjC is complex and there are many ways to use it. Feel free to send me comments, create issues and describe your use cases. This is really first version of this tool and maybe it can do more.

Contact me at jindra@tappytaps.com.