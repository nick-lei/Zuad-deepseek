export declare const layoutControls: {
    readonly observedOn: "2026-11-01";
    readonly controls: readonly [{
        readonly type: "image";
        readonly label: "图片";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: "5000";
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "width";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"960px\"";
        }, {
            readonly field: "height";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"540px\"";
        }];
    }, {
        readonly type: "grid";
        readonly label: "混合组件";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: "5000";
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "videoMute";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "关闭";
                readonly value: "0";
            }, {
                readonly label: "开启";
                readonly value: "1";
            }];
            readonly default: "0";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "webMixed";
        readonly label: "网页混合组件";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "uuid";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "uuid2(36, 16)";
        }, {
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "webMixedInactivityTime";
            readonly inputType: "number";
            readonly event: "input";
            readonly min: "1";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "60";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }, {
            readonly field: "layoutLock";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Close";
                readonly value: "0";
            }, {
                readonly label: "Open";
                readonly value: "1";
            }];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "meetingInformation";
        readonly label: "会议信息(PC端)";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "backgroundColor";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#AFAFAF'";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "exitClient";
        readonly label: "退出客户端(PC端)";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "clase";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#001827'";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "text";
        readonly label: "文字";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "content";
            readonly inputType: null;
            readonly event: "input";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "langCode?.[\"Enter text here\"]";
        }, {
            readonly field: "fontfamily";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Microsoft YaHei";
                readonly value: "Microsoft YaHei";
            }, {
                readonly label: "SimHei Regular";
                readonly value: "SimHei Regular";
            }, {
                readonly label: "SimSun Regular";
                readonly value: "SimSun Regular";
            }, {
                readonly label: "FangSong Regular";
                readonly value: "FangSong Regular";
            }, {
                readonly label: "NSimSun Regular";
                readonly value: "NSimSun Regular";
            }, {
                readonly label: "KaiTi Regular";
                readonly value: "KaiTi Regular";
            }, {
                readonly label: "DengXian";
                readonly value: "DengXian";
            }, {
                readonly label: "LiSu Regular";
                readonly value: "LiSu Regular";
            }, {
                readonly label: "YouYuan Regular";
                readonly value: "YouYuan Regular";
            }];
            readonly default: "\"Microsoft YaHei\"";
        }, {
            readonly field: "fontweight";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Regular";
                readonly value: "normal";
            }, {
                readonly label: "Bold";
                readonly value: "bold";
            }];
            readonly default: "\"normal\"";
        }, {
            readonly field: "alignment";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Left";
                readonly value: "left";
            }, {
                readonly label: "Center";
                readonly value: "center";
            }, {
                readonly label: "Right";
                readonly value: "right";
            }];
            readonly default: "\"left\"";
        }, {
            readonly field: "clase";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#001827'";
        }, {
            readonly field: "fontsize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "50";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "link";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [];
    }, {
        readonly type: "imglink";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [{
            readonly field: "targetpagename";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"无\"";
        }];
    }, {
        readonly type: "block";
        readonly label: "色块";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "backgroundColor";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#AFAFAF'";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "openWindows";
        readonly label: "链接窗口(PC端)";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "backgroundColor";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#AFAFAF'";
        }, {
            readonly field: "hyperlink";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "''";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "variwidth";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "600";
        }, {
            readonly field: "variheight";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "500";
        }];
    }, {
        readonly type: "video";
        readonly label: "视频";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "videosrc";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "''";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "videoMute";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "关闭";
                readonly value: "0";
            }, {
                readonly label: "开启";
                readonly value: "1";
            }];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "width";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"960px\"";
        }, {
            readonly field: "height";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"540px\"";
        }];
    }, {
        readonly type: "audio";
        readonly label: "音频";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "layoutLock";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Close";
                readonly value: "0";
            }, {
                readonly label: "Open";
                readonly value: "1";
            }];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "marquee";
        readonly label: "走马灯";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "content";
            readonly inputType: null;
            readonly event: "input";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "langCode?.[\"Enter text here\"]";
        }, {
            readonly field: "fontfamily";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Microsoft YaHei";
                readonly value: "Microsoft YaHei";
            }, {
                readonly label: "SimHei Regular";
                readonly value: "SimHei Regular";
            }, {
                readonly label: "SimSun Regular";
                readonly value: "SimSun Regular";
            }, {
                readonly label: "FangSong Regular";
                readonly value: "FangSong Regular";
            }, {
                readonly label: "NSimSun Regular";
                readonly value: "NSimSun Regular";
            }, {
                readonly label: "KaiTi Regular";
                readonly value: "KaiTi Regular";
            }, {
                readonly label: "DengXian";
                readonly value: "DengXian";
            }, {
                readonly label: "LiSu Regular";
                readonly value: "LiSu Regular";
            }, {
                readonly label: "YouYuan Regular";
                readonly value: "YouYuan Regular";
            }];
            readonly default: "\"Microsoft YaHei\"";
        }, {
            readonly field: "fontweight";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Regular";
                readonly value: "normal";
            }, {
                readonly label: "Bold";
                readonly value: "bold";
            }];
            readonly default: "\"normal\"";
        }, {
            readonly field: "clase";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#001827'";
        }, {
            readonly field: "fontsize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "50";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "marqueedirection";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Scroll Left";
                readonly value: "left";
            }, {
                readonly label: "Scroll Right";
                readonly value: "right";
            }, {
                readonly label: "Scroll Up";
                readonly value: "up";
            }, {
                readonly label: "Scroll Down";
                readonly value: "down";
            }];
            readonly default: "\"left\"";
        }, {
            readonly field: "marqueescrollspeed";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"5\"";
        }];
    }, {
        readonly type: "pdf";
        readonly label: "PDF";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: "5000";
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }];
    }, {
        readonly type: "word";
        readonly label: "WORD";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: "5000";
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "ppt";
        readonly label: "PPT";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "imgswitchingTime";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: "5000";
            readonly options: readonly [];
            readonly default: "5";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "intraAreaAnimationOptions";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "No Animation";
                readonly value: "no-effect";
            }, {
                readonly label: "Roll In";
                readonly value: "rollIn";
            }, {
                readonly label: "Zoom In";
                readonly value: "zoomIn";
            }, {
                readonly label: "Slide In From Right";
                readonly value: "slideInRight";
            }, {
                readonly label: "Slide In From Left";
                readonly value: "slideInLeft";
            }, {
                readonly label: "Slide In From Top";
                readonly value: "slideInDown";
            }, {
                readonly label: "Slide In From Bottom";
                readonly value: "slideInUp";
            }, {
                readonly label: "Rotate In Up Right";
                readonly value: "rotateInUpRight";
            }, {
                readonly label: "Rotate In Up Left";
                readonly value: "rotateInUpLeft";
            }];
            readonly default: "\"no-effect\"";
        }];
    }, {
        readonly type: "pagelink";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [{
            readonly field: "targetpageid";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"无\"";
        }, {
            readonly field: "targetpagename";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"无\"";
        }];
    }, {
        readonly type: "webbrowser";
        readonly label: "浏览器";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "webbrowserhref";
            readonly inputType: "text";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"\"";
        }, {
            readonly field: "bindControlOid";
            readonly inputType: "text";
            readonly event: "input";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"\"";
        }, {
            readonly field: "eventType";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "点击";
                readonly value: "click";
            }, {
                readonly label: "长按";
                readonly value: "longPress";
            }];
            readonly default: "\"click\"";
        }, {
            readonly field: "roundSize";
            readonly inputType: "number";
            readonly event: "input";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "productList";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [];
    }, {
        readonly type: "singleProduct";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [];
    }, {
        readonly type: "clock";
        readonly label: "时钟";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "timeformat";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "选择";
                readonly value: "HH:mm";
            }, {
                readonly label: "时:分";
                readonly value: "HH:mm";
            }, {
                readonly label: "时:分:秒";
                readonly value: "HH:mm:ss";
            }, {
                readonly label: "年月日 时:分";
                readonly value: "yyyy年MM月dd日 HH:mm";
            }, {
                readonly label: "年月日 时:分:秒";
                readonly value: "yyyy年MM月dd日 HH:mm:ss";
            }, {
                readonly label: "年月日 时:分 星期";
                readonly value: "yyyy年MM月dd日 HH:mm 星期w";
            }, {
                readonly label: "年月日 时:分:秒 星期";
                readonly value: "yyyy年MM月dd日 HH:mm:ss 星期w";
            }, {
                readonly label: "年月日 星期";
                readonly value: "yyyy年MM月dd日 星期w";
            }, {
                readonly label: "年-月-日 时:分 星期";
                readonly value: "yyyy-MM-dd HH:mm 星期w";
            }];
            readonly default: "\"HH:mm\"";
        }, {
            readonly field: "clase";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#001827'";
        }, {
            readonly field: "fontsize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "50";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "qrcode";
        readonly label: "二维码";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "content";
            readonly inputType: null;
            readonly event: "input";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "langCode?.[\"Enter text here\"]";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "table";
        readonly label: "表格";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "tableContent";
            readonly inputType: null;
            readonly event: "input";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "\"\"";
        }, {
            readonly field: "vertical";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: "20";
            readonly options: readonly [];
            readonly default: "1";
        }, {
            readonly field: "horizontal";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: "50";
            readonly options: readonly [];
            readonly default: "1";
        }, {
            readonly field: "fontfamily";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Microsoft YaHei";
                readonly value: "Microsoft YaHei";
            }, {
                readonly label: "SimHei Regular";
                readonly value: "SimHei Regular";
            }, {
                readonly label: "SimSun Regular";
                readonly value: "SimSun Regular";
            }, {
                readonly label: "FangSong Regular";
                readonly value: "FangSong Regular";
            }, {
                readonly label: "NSimSun Regular";
                readonly value: "NSimSun Regular";
            }, {
                readonly label: "KaiTi Regular";
                readonly value: "KaiTi Regular";
            }, {
                readonly label: "DengXian";
                readonly value: "DengXian";
            }, {
                readonly label: "LiSu Regular";
                readonly value: "LiSu Regular";
            }, {
                readonly label: "YouYuan Regular";
                readonly value: "YouYuan Regular";
            }];
            readonly default: "\"Microsoft YaHei\"";
        }, {
            readonly field: "fontweight";
            readonly inputType: null;
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [{
                readonly label: "Regular";
                readonly value: "normal";
            }, {
                readonly label: "Bold";
                readonly value: "bold";
            }];
            readonly default: "\"normal\"";
        }, {
            readonly field: "clase";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#001827'";
        }, {
            readonly field: "fontsize";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "50";
        }, {
            readonly field: "backgroundColor";
            readonly inputType: "color";
            readonly event: "change";
            readonly min: null;
            readonly max: null;
            readonly options: readonly [];
            readonly default: "'#AFAFAF'";
        }, {
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "meetingQrcode";
        readonly label: "会议签到-二维码(PC端)";
        readonly visibleInProgramMenu: true;
        readonly fields: readonly [{
            readonly field: "left";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }, {
            readonly field: "top";
            readonly inputType: "number";
            readonly event: "keyup";
            readonly min: "0";
            readonly max: null;
            readonly options: readonly [];
            readonly default: "0";
        }];
    }, {
        readonly type: "printtext";
        readonly label: null;
        readonly visibleInProgramMenu: false;
        readonly fields: readonly [];
    }];
};
