interface OnHandleErrorFunction {
    (error: object): never
}

interface RequestInterceptorsFunction {
    <T>(config: T): T
}

interface RequestInterceptorsErrorFunction {
    (error: object): (object | any)
}

interface ResponseInterceptorsFunction {
    <T>(data: T, resolve: Promise<any>, reject: Promise<any>): T
}

interface ResponseInterceptorsErrorFunction {
    (error: object): (object | void)
}

interface Option {
    headers?: object,
    method?: string,
}

interface requestOption extends Option {
    uri: string,
    baseURL?: string,
    data?: object,
}

export class Request {
    public interceptors = {
        request: {
            use: (fn: RequestInterceptorsFunction, onError: RequestInterceptorsErrorFunction) => {
                return this._addInterceptors(fn, onError, 'request')
            },
            eject: (obj: any) => {
                if (!obj) {
                    console.error('请传入拦截器对象');
                    return;
                }
                let requestInterceptors = this.requestInterceptors;
                let requestInterceptorsError = this.requestInterceptorsError;
                requestInterceptors.splice(obj.index, 1, config => {
                    return config
                })
                requestInterceptorsError.splice(obj.errIndex, 1, err => {
                })
                this.requestInterceptors = requestInterceptors;
                this.requestInterceptorsError = requestInterceptorsError;
            }
        },
        response: {
            use: (fn: ResponseInterceptorsFunction, onError: ResponseInterceptorsErrorFunction) => {
                return this._addInterceptors(<RequestInterceptorsFunction>fn, onError, 'response')
            },
            eject: (obj: any) => {
                if (!obj) {
                    console.error('请传入拦截器对象');
                    return;
                }
                let responseInterceptors = this.responseInterceptors;
                let responseInterceptorsError = this.responseInterceptorsError;
                responseInterceptors.splice(obj.index, 1, (data, resolve, reject) => {
                    return data
                })
                responseInterceptorsError.splice(obj.errIndex, 1, (err) => {
                })
                this.responseInterceptors = responseInterceptors;
                this.responseInterceptorsError = responseInterceptorsError;
            }
        }
    }
    private readonly url: string;
    private readonly options: Option;
    private requestTask: any;
    private requestInterceptors: RequestInterceptorsFunction[];
    private requestInterceptorsError: RequestInterceptorsErrorFunction[];
    private responseInterceptors: ResponseInterceptorsFunction[];
    private responseInterceptorsError: ResponseInterceptorsErrorFunction[];

    /**
     * 通过new初始化graphql请求全局对象
     */
    constructor(url: string, options: Option) {
        this.url = url
        this.options = options || {}
        this.requestTask = null
        this.requestInterceptors = []
        this.requestInterceptorsError = []
        this.responseInterceptors = []
        this.responseInterceptorsError = []

        let isShowLoading = false;
        let isShowToast = false;
        // @ts-ignore
        const {showLoading, hideLoading, showToast, hideToast} = wx;
        // @ts-ignore
        Object.defineProperty(wx, 'showLoading', {
            configurable: true,
            enumerable: true,
            writable: true,
            value(...param: any[]) {
                if (isShowToast) {
                    return;
                }
                isShowLoading = true;
                return showLoading.apply(this, param);
            }
        });
        // @ts-ignore
        Object.defineProperty(wx, 'hideLoading', {
            configurable: true,
            enumerable: true,
            writable: true,
            value(...param: any[]) {
                if (isShowToast) {
                    return;
                }
                isShowLoading = false;
                return hideLoading.apply(this, param);
            }
        });
        // @ts-ignore
        Object.defineProperty(wx, 'showToast', {
            configurable: true,
            enumerable: true,
            writable: true,
            value(...param: any[]) {
                if (isShowLoading) {
                    // @ts-ignore
                    wx.hideLoading();
                }
                isShowToast = true;
                return showToast.apply(this, param);
            }
        });
        // @ts-ignore
        Object.defineProperty(wx, 'hideToast', {
            configurable: true,
            enumerable: true,
            writable: true,
            value(...param: any[]) {
                isShowToast = false;
                return hideToast.apply(this, param);
            }
        });
    }

    private _addInterceptors(fn: RequestInterceptorsFunction, onError: RequestInterceptorsErrorFunction, type = '') {
        switch (type) {
            case 'request':
                let requestIndex = this.requestInterceptors.push(fn)
                let requestErrIndex = this.requestInterceptorsError.push(onError)
                return {index: requestIndex - 1, errIndex: requestErrIndex - 1}
            case 'response':
                let responseIndex = this.responseInterceptors.push(fn)
                let responseErrIndex = this.responseInterceptorsError.push(onError)
                return {index: responseIndex - 1, errIndex: responseErrIndex - 1}
            default:
                throw '未知拦截器类型'
        }
    }

    /**
     * 取消监听 HTTP Response Header 事件
     */
    offHeadersReceived(fn: any) {
        this.requestTask.offHeadersReceived(fn)
    }

    /**
     * 监听 HTTP Response Header 事件。会比请求完成事件更早
     */
    onHeadersReceived(fn: any) {
        this.requestTask.onHeadersReceived(fn)
    }

    /**
     * 调用abort（）取消最近的一次请求
     */
    abort() {
        this.requestTask.abort()
    }

    /**
     * 请求方法
     */
    async request(options: requestOption) {
        if (!this.url && options.baseURL === '') {
            throw '缺少请求url'
        }
        let newOptions = {
            ...this.options,
            ...options,
        }
        return await new Promise(((resolve, reject) => {
            let allData: requestOption = {
                baseURL: "",
                method: 'GET',
                headers: undefined,
                uri: ""
            }
            if (this.requestInterceptors.length >= 1) {
                this.requestInterceptors.forEach(item => {
                    Object.assign(allData, item(newOptions))
                })
            } else {
                allData = {...allData, ...newOptions}
            }
            let payload = allData.data;
            //@ts-ignore
            this.requestTask = wx.request({
                url: allData.baseURL === '' ? this.url + allData.uri : allData.baseURL + allData.uri,
                method: allData.method,
                data: payload,
                header: allData.headers,
                success: (res: any) => {
                    if (res.statusCode === 200) {
                        if (this.responseInterceptors.length >= 1) {
                            this.responseInterceptors.forEach(item => {
                                // @ts-ignore
                                Object.assign(res, item(res, resolve, reject))
                            })
                        }
                        resolve(res)
                    } else {
                        if (this.responseInterceptorsError.length >= 1 && this.responseInterceptorsError[0] !== undefined) {
                            this.responseInterceptorsError.forEach(item => {
                                item(res)
                            })
                        }
                        reject(res)
                    }
                },
                fail: (err: any) => {
                    if (err.errMsg.indexOf('request:fail') >= 0 && this.requestInterceptorsError.length >= 1 && this.requestInterceptorsError[0] !== undefined) {
                        this.requestInterceptorsError.forEach(item => {
                            item(err)
                        })
                    } else if (this.responseInterceptorsError.length >= 1 && this.responseInterceptorsError[0] !== undefined) {
                        this.responseInterceptorsError.forEach(item => {
                            item(err)
                        })
                    }
                    reject(err)
                },
                complete: (res: any) => {
                    //@ts-ignore
                    wx.hideLoading()
                }
            })
        }))
    }
}


