//----------------------------------------------------------------------
// @preserve Copyright (c) Microsoft Open Technologies, Inc.
// All Rights Reserved
// Apache License 2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//----------------------------------------------------------------------
enum RequestType {
    LOGIN = "LOGIN",
    RENEW_TOKEN = "RENEW_TOKEN",
    UNKNOWN = "UNKNOWN",
}
enum ResponseType {
    ID_TOKEN = "id_token token",
    TOKEN = "token",
}

enum TokenRenewStatus {
    Canceled = "Canceled",
    Completed = "Completed",
    InProgress = "In Progress",
}

let ACCESS_TOKEN = "access_token",
    EXPIRES_IN = "expires_in",
    ID_TOKEN = "id_token",
    ERROR = "error",
    ERROR_DESCRIPTION = "error_description",
    SESSION_STATE = "session_state",
    RESOURCE_DELIMETER = "|",
    CACHE_DELIMETER = "||",
    SINGLETON = "_adalInstance"

type RequestInfo = {
    parameters: {[key: string]: any}
    requestType: RequestType
    stateMatch: boolean
    stateResponse: string
    valid: boolean
}

export type Config = any // TODO
export type User =
    | {
          profile: UserProfile
      }
    | undefined

interface UserProfile {
    aud: string
    iss: string
    iat: number
    nbf: number
    exp: number
    acct: number
    aio: string
    amr: string[]
    family_name: string
    given_name: string
    in_corp: string
    ipaddr: string
    name: string
    nonce: string
    oid: string
    onprem_sid: string
    puid: string
    rh: string
    sub: string
    tid: string
    unique_name: string
    upn: string
    uti: string
    ver: string
    xms_mpci: number
    xms_pci: number
    mri: string
}

export interface AuthenticationContext {
    config: Config
    login(): void
    logout(): void
    getUser(): User | undefined
    registerCallback(expectedState: any, resource: string, callback: any): void
    acquireToken(resource: string, callback: any): void
    acquireTokenPopup(
        resource: string,
        extraQueryParameters: string,
        claims: string | undefined,
        callback: any,
    ): void
    getRequestInfo(hash: string): RequestInfo
    saveTokenFromHash(requestInfo: RequestInfo): void
    handleWindowCallback(hash?: string): void
    _callBackMappedToRenewStates: any
    _callBacksMappedToRenewStates: any
}

export let createAuthenticationContext = (
    config: Config,
): AuthenticationContext => {
    if ((window as any)[SINGLETON]) {
        return (window as any)[SINGLETON]
    }

    config = readConfig(config)
    let _user: any
    let _idTokenNonce: any
    let _activeRenewals: any = {}
    let _loginInProgress = false
    let _acquireTokenInProgress = false
    let _renewStates: any[] = []
    let _openedWindows: any[] = []
    let _callBackMappedToRenewStates: any = {}
    let _callBacksMappedToRenewStates: any = {}
    let _requestType = RequestType.LOGIN

    /**
     * Initiates the login process by redirecting the user to Azure AD authorization endpoint.
     */
    let login = async (): Promise<void> => {
        if (_loginInProgress) {
            throw new Error("login already in progress")
        }
        _loginInProgress = true
        // Token is not present and user needs to login
        let expectedState = guid()
        let loginStartPage = window.location.href
        config.state = expectedState
        _idTokenNonce = guid()
        saveItem(StorageKey.LOGIN_REQUEST, loginStartPage)
        saveItem(StorageKey.LOGIN_ERROR, "")
        saveItem(StorageKey.STATE_LOGIN, expectedState, true)
        saveItem(StorageKey.NONCE_IDTOKEN, _idTokenNonce, true)
        saveItem(StorageKey.ERROR, "")
        saveItem(StorageKey.ERROR_DESCRIPTION, "")
        let url = getNavigateUrl("id_token") + "&nonce=" + encode(_idTokenNonce)

        if (config.displayCall) {
            config.displayCall(url)
        } else if (config.popUp) {
            saveItem(StorageKey.STATE_LOGIN, "") // so requestInfo does not match redirect case
            _renewStates.push(expectedState)
            return new Promise((resolve, reject) => {
                registerCallback(
                    expectedState,
                    config.clientId,
                    (
                        errorDesc: any,
                        token: any,
                        error: any,
                        tokenType: any,
                    ) => {
                        if (error) {
                            reject(error)
                        } else {
                            resolve()
                        }
                    },
                )
                loginPopup(url)
            })
        } else {
            promptUser(url)
        }
    }

    /**
     * Configures popup window for login.
     * @ignore
     */
    let openPopup = (
        urlNavigate: string,
        title: string,
        popUpWidth: number,
        popUpHeight: number,
    ) => {
        try {
            let left = window.innerWidth / 2 - popUpWidth / 2 + window.screenX
            let top = window.innerHeight / 2 - popUpHeight / 2 + window.screenY
            let popupWindow = window.open(
                urlNavigate,
                title,
                "width=" +
                    popUpWidth +
                    ", height=" +
                    popUpHeight +
                    ", top=" +
                    top +
                    ", left=" +
                    left,
            )!
            if (popupWindow.focus) {
                popupWindow.focus()
            }
            return popupWindow
        } catch (e) {
            if (process.env.NODE_ENV === "development") {
                Logger.warn("Error opening popup, " + e.message)
            }
            _loginInProgress = false
            _acquireTokenInProgress = false
        }
    }

    let handlePopupError = (
        loginCallback: any,
        resource: string | undefined | null,
        error: string,
        errorDesc: string,
        loginError: string,
    ) => {
        if (process.env.NODE_ENV === "development") {
            Logger.warn(errorDesc)
        }
        saveItem(StorageKey.ERROR, error)
        saveItem(StorageKey.ERROR_DESCRIPTION, errorDesc)
        saveItem(StorageKey.LOGIN_ERROR, loginError)

        if (resource && _activeRenewals[resource]) {
            _activeRenewals[resource] = null
        }

        _loginInProgress = false
        _acquireTokenInProgress = false

        if (loginCallback) {
            loginCallback(errorDesc, null, error)
        }
    }

    /**
     * After authorization, the user will be sent to your specified redirect_uri with the user's bearer token
     * attached to the URI fragment as an id_token field. It closes popup window after redirection.
     * @ignore
     */
    let loginPopup = (
        urlNavigate: string,
        resource?: string,
        callback?: any,
    ) => {
        var popupWindow = openPopup(urlNavigate, "login", 483, 600)
        var loginCallback = callback || config.callback

        if (!popupWindow) {
            var error = "Error opening popup"
            var errorDesc =
                "Popup Window is null. This can happen if you are using IE"
            handlePopupError(
                loginCallback,
                resource,
                error,
                errorDesc,
                errorDesc,
            )
            return
        }

        _openedWindows.push(popupWindow)
        let registeredRedirectUri = config.redirectUri.split("#")[0]

        let pollTimer = setInterval(() => {
            if (
                !popupWindow ||
                popupWindow.closed ||
                popupWindow.closed === undefined
            ) {
                let error = "Popup Window closed"
                let errorDesc =
                    "Popup Window closed by UI action/ Popup Window handle destroyed due to cross zone navigation in IE/Edge"

                handlePopupError(
                    loginCallback,
                    resource,
                    error,
                    errorDesc,
                    errorDesc,
                )
                clearInterval(pollTimer)
                return
            }

            try {
                let popUpWindowLocation = popupWindow.location
                if (
                    encodeURI(popUpWindowLocation.href).indexOf(
                        encodeURI(registeredRedirectUri),
                    ) != -1
                ) {
                    handleWindowCallback(popUpWindowLocation.hash)
                    clearInterval(pollTimer)
                    _loginInProgress = false
                    _acquireTokenInProgress = false
                    if (process.env.NODE_ENV === "development") {
                        Logger.info("Closing popup window")
                    }
                    _openedWindows = []
                    popupWindow.close()
                    return
                }
            } catch (e) {}
        }, 1)
    }

    let getUser = () => {
        if (!_user) {
            let idToken = getItem(StorageKey.IDTOKEN)
            if (idToken) {
                _user = createUser(idToken)
            }
        }
        return _user
    }

    /**
     * Gets token for the specified resource from the cache.
     * @param {string}   resource A URI that identifies the resource for which the token is requested.
     * @returns {string} token if if it exists and not expired, otherwise null.
     */
    let getCachedToken = (resource: string): string | undefined => {
        if (!hasResource(resource)) return

        let token = getItem(StorageKey.ACCESS_TOKEN_KEY + resource)
        let expiry = getItem(StorageKey.EXPIRATION_KEY + resource)

        if (expiry && expiry > now() + config.expireOffsetSeconds) {
            return token
        } else {
            saveItem(StorageKey.ACCESS_TOKEN_KEY + resource, "")
            saveItem(StorageKey.EXPIRATION_KEY + resource, 0)
        }
    }

    /**
     * Adds the passed callback to the array of callbacks for the specified resource and puts the array on the window object.
     * @param {string}   resource A URI that identifies the resource for which the token is requested.
     * @param {string}   expectedState A unique identifier (guid).
     * @param {tokenCallback} callback - The callback provided by the caller. It will be called with token or error.
     */
    let registerCallback = (
        expectedState: any,
        resource: string,
        callback: any,
    ) => {
        _activeRenewals[resource] = expectedState

        if (!_callBacksMappedToRenewStates[expectedState]) {
            _callBacksMappedToRenewStates[expectedState] = []
        }

        _callBacksMappedToRenewStates[expectedState].push(callback)

        if (!_callBackMappedToRenewStates[expectedState]) {
            _callBackMappedToRenewStates[expectedState] = (
                errorDesc: any,
                token: any,
                error: any,
                tokenType: any,
            ) => {
                _activeRenewals[resource] = null
                for (let fn of _callBacksMappedToRenewStates[expectedState]) {
                    try {
                        fn(errorDesc, token, error, tokenType)
                    } catch (error) {
                        if (process.env.NODE_ENV === "development") {
                            Logger.warn(error)
                        }
                    }
                }
                _callBacksMappedToRenewStates[expectedState] = null
                _callBackMappedToRenewStates[expectedState] = null
            }
        }
    }

    /**
     * Acquires access token with hidden iframe
     * @ignore
     */
    let renewToken = (
        resource: string,
        callback: any,
        responseType = "token",
    ) => {
        // use iframe to try to renew token
        // use given resource to create new authz url
        if (process.env.NODE_ENV === "development") {
            Logger.info("renewToken is called for resource:" + resource)
        }
        let frameHandle = addAdalFrame("adalRenewFrame" + resource)
        let expectedState = guid() + RESOURCE_DELIMETER + resource
        config.state = expectedState
        _renewStates.push(expectedState)
        if (process.env.NODE_ENV === "development") {
            Logger.verbose("Renew token Expected state: " + expectedState)
        }
        // remove the existing prompt=... query parameter and add prompt=none
        let urlNavigate = removeQueryStringParameter(
            getNavigateUrl(responseType, resource),
            "prompt",
        )

        if (responseType === ResponseType.ID_TOKEN) {
            _idTokenNonce = guid()
            saveItem(StorageKey.NONCE_IDTOKEN, _idTokenNonce, true)
            urlNavigate += "&nonce=" + encode(_idTokenNonce)
        }

        urlNavigate += "&prompt=none"
        urlNavigate = addHintParameters(urlNavigate)
        registerCallback(expectedState, resource, callback)
        if (process.env.NODE_ENV === "development") {
            Logger.verbosePii("Navigate to:" + urlNavigate)
        }
        ;(frameHandle as any).src = "about:blank"
        loadFrameTimeout(urlNavigate, "adalRenewFrame" + resource, resource)
    }

    /**
     * Renews idtoken for app's own backend when resource is clientId and calls the callback with token/error
     * @ignore
     */
    let renewIdToken = (callback: any, responseType?: string) => {
        // use iframe to try to renew token
        let frameHandle = addAdalFrame("adalIdTokenFrame")
        let expectedState = guid() + RESOURCE_DELIMETER + config.clientId
        _idTokenNonce = guid()
        saveItem(StorageKey.NONCE_IDTOKEN, _idTokenNonce, true)
        config.state = expectedState
        // renew happens in iframe, so it keeps javascript context
        _renewStates.push(expectedState)
        if (process.env.NODE_ENV === "development") {
            Logger.verbose("Renew Idtoken Expected state: " + expectedState)
        }
        // remove the existing prompt=... query parameter and add prompt=none
        let resource = responseType || config.clientId
        responseType = responseType || "id_token"
        let urlNavigate = removeQueryStringParameter(
            getNavigateUrl(responseType, resource),
            "prompt",
        )
        urlNavigate = addHintParameters(urlNavigate + "&prompt=none")
        urlNavigate += "&nonce=" + encode(_idTokenNonce)
        registerCallback(expectedState, config.clientId, callback)
        if (process.env.NODE_ENV === "development") {
            Logger.verbosePii("Navigate to:" + urlNavigate)
        }
        ;(frameHandle as any).src = "about:blank"
        loadFrameTimeout(urlNavigate, "adalIdTokenFrame", config.clientId)
    }

    let loadFrameTimeout = (
        urlNavigation: string,
        frameName: string,
        resource: string,
    ) => {
        //set iframe session to pending
        if (process.env.NODE_ENV === "development") {
            Logger.verbose("Set loading state to pending for: " + resource)
        }
        saveItem(
            StorageKey.RENEW_STATUS + resource,
            TokenRenewStatus.InProgress,
        )
        loadFrame(urlNavigation, frameName)

        setTimeout(() => {
            if (
                getItem(StorageKey.RENEW_STATUS + resource) ===
                TokenRenewStatus.InProgress
            ) {
                // fail the iframe session if it's in pending state
                if (process.env.NODE_ENV === "development") {
                    Logger.verbose(
                        "Loading frame has timed out after: " +
                            config.loadFrameTimeout / 1000 +
                            " seconds for resource " +
                            resource,
                    )
                }
                var expectedState = _activeRenewals[resource]

                if (
                    expectedState &&
                    _callBackMappedToRenewStates[expectedState]
                ) {
                    _callBackMappedToRenewStates[expectedState](
                        "Token renewal operation failed due to timeout",
                        null,
                        "Token Renewal Failed",
                    )
                }

                saveItem(
                    StorageKey.RENEW_STATUS + resource,
                    TokenRenewStatus.Canceled,
                )
            }
        }, config.loadFrameTimeout)
    }

    /**
     * Loads iframe with authorization endpoint URL
     */
    let loadFrame = (urlNavigate: string, frameName: string) => {
        // This trick overcomes iframe navigation in IE
        // IE does not load the page consistently in iframe
        if (process.env.NODE_ENV === "development") {
            Logger.info("LoadFrame: " + frameName)
        }
        setTimeout(() => {
            let frameHandle = addAdalFrame(frameName) as any
            if (!frameHandle.src || frameHandle.src === "about:blank") {
                frameHandle.src = urlNavigate
                loadFrame(urlNavigate, frameName)
            }
        }, 500)
    }

    /**
     * Acquires token from the cache if it is not expired. Otherwise sends request to AAD to obtain a new token.
     * @param {string}   resource  ResourceUri identifying the target resource
     */
    let acquireToken = (resource: string, callback: any) => {
        if (!resource) {
            let error = "resource is required"
            if (process.env.NODE_ENV === "development") {
                Logger.warn(error)
            }
            callback(error, null, error)
            return
        }

        let token = getCachedToken(resource)
        if (token) {
            if (process.env.NODE_ENV === "development") {
                Logger.info(
                    "Token is already in cache for resource:" + resource,
                )
            }
            callback(null, token, null)
            return
        }

        if (
            !_user &&
            !(
                config.extraQueryParameter &&
                config.extraQueryParameter.indexOf("login_hint") !== -1
            )
        ) {
            let error = "User login is required"
            if (process.env.NODE_ENV === "development") {
                Logger.warn(error)
            }
            callback(error, null, error)
            return
        }

        // renew attempt with iframe
        // Already renewing for this resource, callback when we get the token.
        if (_activeRenewals[resource]) {
            // Active renewals contains the state for each renewal.
            registerCallback(_activeRenewals[resource], resource, callback)
        } else {
            _requestType = RequestType.RENEW_TOKEN
            if (resource === config.clientId) {
                // App uses idtoken to send to api endpoints
                // Default resource is tracked as clientid to store this token
                if (_user) {
                    if (process.env.NODE_ENV === "development") {
                        Logger.verbose("renewing idtoken")
                    }
                    renewIdToken(callback)
                } else {
                    if (process.env.NODE_ENV === "development") {
                        Logger.verbose("renewing idtoken and access_token")
                    }
                    renewIdToken(callback, ResponseType.ID_TOKEN)
                }
            } else {
                if (_user) {
                    if (process.env.NODE_ENV === "development") {
                        Logger.verbose("renewing access_token")
                    }
                    renewToken(resource, callback)
                } else {
                    if (process.env.NODE_ENV === "development") {
                        Logger.verbose("renewing idtoken and access_token")
                    }
                    renewToken(resource, callback, ResponseType.ID_TOKEN)
                }
            }
        }
    }

    /**
     * Acquires token (interactive flow using a popUp window) by sending request to AAD to obtain a new token.
     * @param {string}   resource  ResourceUri identifying the target resource
     * @param {string}   extraQueryParameters  extraQueryParameters to add to the authentication request
     * @param {tokenCallback} callback -  The callback provided by the caller. It will be called with token or error.
     */
    let acquireTokenPopup = (
        resource: any,
        extraQueryParameters: any,
        claims: any,
        callback: any,
    ) => {
        if (!canAcquireToken(resource)) {
            return
        }

        var expectedState = guid() + RESOURCE_DELIMETER + resource
        config.state = expectedState
        _renewStates.push(expectedState)
        _requestType = RequestType.RENEW_TOKEN
        if (process.env.NODE_ENV === "development") {
            Logger.verbose("Renew token Expected state: " + expectedState)
        }
        // remove the existing prompt=... query parameter and add prompt=select_account
        var urlNavigate = removeQueryStringParameter(
            getNavigateUrl("token", resource),
            "prompt",
        )
        urlNavigate += "&prompt=select_account"

        if (extraQueryParameters) {
            urlNavigate += extraQueryParameters
        }
        if (claims) {
            if (urlNavigate.indexOf("&claims") === -1) {
                urlNavigate += "&claims=" + encode(claims)
            } else {
                throw new Error(
                    "Claims cannot be passed as an extraQueryParameter",
                )
            }
        }

        urlNavigate = addHintParameters(urlNavigate)
        _acquireTokenInProgress = true
        if (process.env.NODE_ENV === "development") {
            Logger.info(
                "acquireToken interactive is called for the resource " +
                    resource,
            )
        }
        registerCallback(expectedState, resource, callback)
        loginPopup(urlNavigate, resource, callback)
    }

    /**
     * Acquires token (interactive flow using a redirect) by sending request to AAD to obtain a new token. In this case the callback passed in the Authentication
     * request constructor will be called.
     * @param {string}   resource  ResourceUri identifying the target resource
     * @param {string}   extraQueryParameters  extraQueryParameters to add to the authentication request
     */
    let acquireTokenRedirect = (
        resource: string,
        extraQueryParameters: any,
        claims: any,
    ) => {
        if (!canAcquireToken(resource)) {
            return
        }

        let expectedState = guid() + RESOURCE_DELIMETER + resource
        config.state = expectedState
        if (process.env.NODE_ENV === "development") {
            Logger.verbose("Renew token Expected state: " + expectedState)
        }

        // remove the existing prompt=... query parameter and add prompt=select_account
        var urlNavigate = removeQueryStringParameter(
            getNavigateUrl("token", resource),
            "prompt",
        )
        urlNavigate = urlNavigate + "&prompt=select_account"
        if (extraQueryParameters) {
            urlNavigate += extraQueryParameters
        }

        if (claims && urlNavigate.indexOf("&claims") === -1) {
            urlNavigate += "&claims=" + encode(claims)
        } else if (claims && urlNavigate.indexOf("&claims") !== -1) {
            throw new Error("Claims cannot be passed as an extraQueryParameter")
        }

        urlNavigate = addHintParameters(urlNavigate)
        _acquireTokenInProgress = true
        if (process.env.NODE_ENV === "development") {
            Logger.info(
                "acquireToken interactive is called for the resource " +
                    resource,
            )
        }
        saveItem(StorageKey.LOGIN_REQUEST, window.location.href)
        saveItem(StorageKey.STATE_RENEW, expectedState, true)
        promptUser(urlNavigate)
    }

    let canAcquireToken = (resource: string): boolean => {
        let error: string | undefined
        if (!resource) {
            error = "Resource is required"
        } else if (!_user) {
            error = "User login is required"
        } else if (_acquireTokenInProgress) {
            error = "Acquire token interactive is already in progress"
        }
        if (error) {
            if (process.env.NODE_ENV === "development") {
                Logger.warn(error)
            }
            config.callback(error, null, error)
        }
        return !error
    }

    /**
     * Redirects the browser to Azure AD authorization endpoint.
     */
    let promptUser = (url: string) => {
        if (url) {
            if (process.env.NODE_ENV === "development") {
                Logger.infoPii("Navigate to:" + url)
            }
            window.location.replace(url)
        } else {
            if (process.env.NODE_ENV === "development") {
                Logger.info("Navigate url is empty")
            }
        }
    }

    let clearCache = () => {
        saveItem(StorageKey.LOGIN_REQUEST, "")
        saveItem(StorageKey.SESSION_STATE, "")
        saveItem(StorageKey.STATE_LOGIN, "")
        saveItem(StorageKey.STATE_RENEW, "")
        _renewStates = []
        saveItem(StorageKey.NONCE_IDTOKEN, "")
        saveItem(StorageKey.IDTOKEN, "")
        saveItem(StorageKey.ERROR, "")
        saveItem(StorageKey.ERROR_DESCRIPTION, "")
        saveItem(StorageKey.LOGIN_ERROR, "")
        saveItem(StorageKey.LOGIN_ERROR, "")
        var keys = getItem(StorageKey.TOKEN_KEYS) as any

        if (!isEmpty(keys)) {
            keys = keys.split(RESOURCE_DELIMETER)
            for (var i = 0; i < keys.length && keys[i] !== ""; i++) {
                saveItem(StorageKey.ACCESS_TOKEN_KEY + keys[i], "")
                saveItem(StorageKey.EXPIRATION_KEY + keys[i], 0)
            }
        }

        saveItem(StorageKey.TOKEN_KEYS, "")
    }

    /**
     * Redirects user to logout endpoint.
     * After logout, it will redirect to postLogoutRedirectUri if added as a property on the config object.
     */
    let logout = () => {
        clearCache()
        _user = null
        let urlNavigate: string

        if (config.logOutUri) {
            urlNavigate = config.logOutUri
        } else {
            let logout = ""
            if (config.postLogoutRedirectUri) {
                logout =
                    "post_logout_redirect_uri=" +
                    encode(config.postLogoutRedirectUri)
            }

            urlNavigate =
                config.instance + config.tenant + "/oauth2/logout?" + logout
        }

        if (process.env.NODE_ENV === "development") {
            Logger.infoPii("Logout navigate to: " + urlNavigate)
        }
        promptUser(urlNavigate)
    }

    /**
     * Adds login_hint to authorization URL which is used to pre-fill the username field of sign in page for the user if known ahead of time.
     * domain_hint can be one of users/organisations which when added skips the email based discovery process of the user.
     * @ignore
     */
    let addHintParameters = (url: string) => {
        //If you dont use prompt=none, then if the session does not exist, there will be a failure.
        //If sid is sent alongside domain or login hints, there will be a failure since request is ambiguous.
        //If sid is sent with a prompt value other than none or attempt_none, there will be a failure since the request is ambiguous.

        if (!_user || !_user.profile) {
            return url
        }

        if (_user.profile.sid && url.indexOf("&prompt=none") !== -1) {
            // don't add sid twice if user provided it in the extraQueryParameter value
            if (!urlContainsQueryStringParameter("sid", url)) {
                // add sid
                url += "&sid=" + encode(_user.profile.sid)
            }
        } else if (_user.profile.upn) {
            // don't add login_hint twice if user provided it in the extraQueryParameter value
            if (!urlContainsQueryStringParameter("login_hint", url)) {
                // add login_hint
                url += "&login_hint=" + encode(_user.profile.upn)
            }
            // don't add domain_hint twice if user provided it in the extraQueryParameter value
            if (
                !urlContainsQueryStringParameter("domain_hint", url) &&
                _user.profile.upn.indexOf("@") > -1
            ) {
                var parts = _user.profile.upn.split("@")
                // local part can include @ in quotes. Sending last part handles that.
                url += "&domain_hint=" + encode(parts[parts.length - 1])
            }
        }
        return url
    }

    /**
     * Creates a user object by decoding the id_token
     * @ignore
     */
    let createUser = (idToken: string) => {
        let json = extractIdToken(idToken)
        if (!has(json, "aud")) {
            return
        }

        if (json.aud.toLowerCase() !== config.clientId.toLowerCase()) {
            if (process.env.NODE_ENV === "development") {
                Logger.warn("IdToken has invalid aud field")
            }
        } else {
            return {
                userName: json.upn || json.email,
                profile: json,
            }
        }
    }

    /**
     * Creates a requestInfo object from the URL fragment and returns it.
     */
    let getRequestInfo = (hash: string): RequestInfo => {
        let requestInfo: RequestInfo = {
            valid: false,
            parameters: {},
            stateMatch: false,
            stateResponse: "",
            requestType: RequestType.UNKNOWN,
        }

        let parameters = deserialize(getHash(hash)) as any
        if (!parameters) {
            return requestInfo
        }

        requestInfo.parameters = parameters
        if (
            has(parameters, ERROR_DESCRIPTION) ||
            has(parameters, ACCESS_TOKEN) ||
            has(parameters, ID_TOKEN)
        ) {
            requestInfo.valid = true

            if (has(parameters, "state")) {
                if (process.env.NODE_ENV === "development") {
                    Logger.verbose("State: " + parameters.state)
                }
                requestInfo.stateResponse = parameters.state
            } else {
                if (process.env.NODE_ENV === "development") {
                    Logger.warn("No state returned")
                }
                return requestInfo
            }

            // async calls can fire iframe and login request at the same time if developer does not use the API as expected
            // incoming callback needs to be looked up to find the request type
            // loginRedirect or acquireTokenRedirect
            if (matchState(requestInfo)) {
                return requestInfo
            }

            // external api requests may have many renewtoken requests for different resource
            if (!requestInfo.stateMatch && window.parent) {
                requestInfo.requestType = _requestType
                for (let state of _renewStates) {
                    if (state === requestInfo.stateResponse) {
                        requestInfo.stateMatch = true
                        break
                    }
                }
            }
        }
        return requestInfo
    }

    /**
     * Matches state from the request with the response.
     * @ignore
     */
    let matchState = (requestInfo: any) => {
        let loginStates = getItem(StorageKey.STATE_LOGIN)
        if (loginStates) {
            for (let state of loginStates.split(CACHE_DELIMETER)) {
                if (state === requestInfo.stateResponse) {
                    requestInfo.requestType = RequestType.LOGIN
                    requestInfo.stateMatch = true
                    return true
                }
            }
        }

        let acquireTokenStates = getItem(StorageKey.STATE_RENEW)
        if (acquireTokenStates) {
            for (let state of acquireTokenStates.split(CACHE_DELIMETER)) {
                if (state === requestInfo.stateResponse) {
                    requestInfo.requestType = RequestType.RENEW_TOKEN
                    requestInfo.stateMatch = true
                    return true
                }
            }
        }

        return false
    }

    /**
     * Saves token or error received in the response from AAD in the cache. In case of id_token, it also creates the user object.
     */
    let saveTokenFromHash = (requestInfo: RequestInfo) => {
        if (process.env.NODE_ENV === "development") {
            Logger.info(
                "State status:" +
                    requestInfo.stateMatch +
                    "; Request type:" +
                    requestInfo.requestType,
            )
        }
        saveItem(StorageKey.ERROR, "")
        saveItem(StorageKey.ERROR_DESCRIPTION, "")

        let resource = getResourceFromState(requestInfo.stateResponse)

        // Record error
        if (has(requestInfo.parameters, ERROR_DESCRIPTION)) {
            if (process.env.NODE_ENV === "development") {
                Logger.infoPii(
                    "Error :" +
                        requestInfo.parameters.error +
                        "; Error description:" +
                        requestInfo.parameters[ERROR_DESCRIPTION],
                )
            }
            saveItem(StorageKey.ERROR, requestInfo.parameters.error)
            saveItem(
                StorageKey.ERROR_DESCRIPTION,
                requestInfo.parameters[ERROR_DESCRIPTION],
            )

            if (requestInfo.requestType === RequestType.LOGIN) {
                _loginInProgress = false
                saveItem(
                    StorageKey.LOGIN_ERROR,
                    requestInfo.parameters.error_description,
                )
            }
        } else {
            // It must verify the state from redirect
            if (requestInfo.stateMatch) {
                // record tokens to storage if exists
                if (process.env.NODE_ENV === "development") {
                    Logger.info("State is right")
                }
                if (has(requestInfo.parameters, SESSION_STATE)) {
                    saveItem(
                        StorageKey.SESSION_STATE,
                        requestInfo.parameters[SESSION_STATE],
                    )
                }

                let keys

                if (has(requestInfo.parameters, ACCESS_TOKEN)) {
                    if (process.env.NODE_ENV === "development") {
                        Logger.info("Fragment has access token")
                    }

                    if (!hasResource(resource)) {
                        keys = getItem(StorageKey.TOKEN_KEYS) || ""
                        saveItem(
                            StorageKey.TOKEN_KEYS,
                            keys + resource + RESOURCE_DELIMETER,
                        )
                    }

                    // save token with related resource
                    saveItem(
                        StorageKey.ACCESS_TOKEN_KEY + resource,
                        requestInfo.parameters[ACCESS_TOKEN],
                    )
                    saveItem(
                        StorageKey.EXPIRATION_KEY + resource,
                        expiresIn(requestInfo.parameters[EXPIRES_IN]),
                    )
                }

                if (has(requestInfo.parameters, ID_TOKEN)) {
                    // info("Fragment has id token")
                    _loginInProgress = false
                    _user = createUser(requestInfo.parameters[ID_TOKEN])
                    if (_user && _user.profile) {
                        if (!matchNonce(_user)) {
                            saveItem(
                                StorageKey.LOGIN_ERROR,
                                "Nonce received: " +
                                    _user.profile.nonce +
                                    " is not same as requested: " +
                                    getItem(StorageKey.NONCE_IDTOKEN),
                            )
                            _user = null
                        } else {
                            saveItem(
                                StorageKey.IDTOKEN,
                                requestInfo.parameters[ID_TOKEN],
                            )

                            // Save idtoken as access token for app itself
                            resource = config.loginResource
                                ? config.loginResource
                                : config.clientId

                            if (!hasResource(resource)) {
                                keys = getItem(StorageKey.TOKEN_KEYS) || ""
                                saveItem(
                                    StorageKey.TOKEN_KEYS,
                                    keys + resource + RESOURCE_DELIMETER,
                                )
                            }

                            saveItem(
                                StorageKey.ACCESS_TOKEN_KEY + resource,
                                requestInfo.parameters[ID_TOKEN],
                            )
                            saveItem(
                                StorageKey.EXPIRATION_KEY + resource,
                                _user.profile.exp,
                            )
                        }
                    } else {
                        let error = "invalid id_token"
                        let description =
                            "Invalid id_token. id_token: " +
                            requestInfo.parameters[ID_TOKEN]

                        requestInfo.parameters.error = error
                        requestInfo.parameters.error_description = description
                        requestInfo.parameters[ID_TOKEN]
                        saveItem(StorageKey.ERROR, error)
                        saveItem(StorageKey.ERROR_DESCRIPTION, description)
                    }
                }
            } else {
                let error = "Invalid_state"
                let description =
                    "Invalid_state. state: " + requestInfo.stateResponse

                requestInfo.parameters.error = error
                requestInfo.parameters.error_description = description

                saveItem(StorageKey.ERROR, error)
                saveItem(StorageKey.ERROR_DESCRIPTION, description)
            }
        }

        saveItem(StorageKey.RENEW_STATUS + resource, TokenRenewStatus.Completed)
    }

    /**
     * This method must be called for processing the response received from AAD. It extracts the hash, processes the token or error, saves it in the cache and calls the registered callbacks with the result.
     * @param {string} [hash=window.location.hash] - Hash fragment of Url.
     */
    let handleWindowCallback = (hash: string = window.location.hash) => {
        if (!isCallback(hash)) return

        let self!: AuthenticationContext
        let isPopup

        let lastWindow = _openedWindows[_openedWindows.length - 1]
        if (
            lastWindow &&
            lastWindow.opener &&
            lastWindow.opener._AuthenticationContextInstance
        ) {
            self = lastWindow.opener._adalInstance
            isPopup = true
        } else if (window.parent && (window.parent as any)._adalInstance) {
            self = (window.parent as any)._adalInstance
        }

        let requestInfo = self.getRequestInfo(hash)
        let tokenReceivedCallback: any

        if (isPopup || window.parent !== window) {
            tokenReceivedCallback =
                self._callBackMappedToRenewStates[requestInfo.stateResponse]
        } else {
            tokenReceivedCallback = self.config.callback
        }

        self.saveTokenFromHash(requestInfo)

        let token: any
        let tokenType: any
        if (
            requestInfo.requestType === RequestType.RENEW_TOKEN &&
            window.parent
        ) {
            if (process.env.NODE_ENV === "development") {
                if (window.parent !== window) {
                    Logger.verbose(
                        "Window is in iframe, acquiring token silently",
                    )
                } else {
                    Logger.verbose("acquiring token interactive in progress")
                }
            }

            token =
                requestInfo.parameters[ACCESS_TOKEN] ||
                requestInfo.parameters[ID_TOKEN]
            tokenType = ACCESS_TOKEN
        } else if (requestInfo.requestType === RequestType.LOGIN) {
            token = requestInfo.parameters[ID_TOKEN]
            tokenType = ID_TOKEN
        }

        try {
            if (tokenReceivedCallback) {
                let error = requestInfo.parameters[ERROR]
                let description = requestInfo.parameters[ERROR_DESCRIPTION]
                tokenReceivedCallback(description, token, error, tokenType)
            }
        } catch (err) {
            if (process.env.NODE_ENV === "development") {
                Logger.error(
                    "Error occurred in user defined callback function: " + err,
                )
            }
        }

        if (window.parent === window && !isPopup) {
            if (self.config.navigateToLoginRequestUrl) {
                window.location.href = getItem(StorageKey.LOGIN_REQUEST)
            } else {
                window.location.hash = ""
            }
        }
    }

    /**
     * Constructs the authorization endpoint URL
     */
    let getNavigateUrl = (responseType: string, resource?: string) =>
        config.instance +
        config.tenant +
        "/oauth2/authorize" +
        serialize(responseType, config, resource)

    /**
     * Returns the decoded id_token.
     */
    let extractIdToken = (encodedIdToken: string) => {
        // TODO: decodeJWT can be inlined.
        let decodedToken = decodeJWT(encodedIdToken)
        if (!decodedToken) {
            return
        }
        try {
            let base64IdToken = decodedToken.JWSPayload
            let base64Decoded = base64DecodeStringUrlSafe(base64IdToken)

            if (!base64Decoded) {
                if (process.env.NODE_ENV === "development") {
                    Logger.info(
                        "The returned id_token could not be base64 url safe decoded.",
                    )
                }
                return
            }
            return JSON.parse(base64Decoded)
        } catch (err) {
            if (process.env.NODE_ENV === "development") {
                Logger.error("The returned id_token could not be decoded", err)
            }
        }
    }

    /**
     * Decodes a string of data which has been encoded using base-64 encoding.
     */
    let base64DecodeStringUrlSafe = (base64IdToken: string) => {
        base64IdToken = base64IdToken.replace(/-/g, "+").replace(/_/g, "/")
        return decodeURIComponent(escape(window.atob(base64IdToken)))
    }

    /**
     * Adds the hidden iframe for silent token renewal
     */
    let addAdalFrame = (iframeId: string) => {
        let adalFrame = document.getElementById(iframeId)
        if (adalFrame) {
            return adalFrame
        }

        if (process.env.NODE_ENV === "development") {
            Logger.info("Add adal frame to document:" + iframeId)
        }
        // NOTE: removed special case for legacy opera/IE
        document.body.insertAdjacentHTML(
            "beforeEnd" as any,
            `<iframe name="${iframeId}" id="${iframeId}" style="display:none"></iframe>`,
        )
        return window.frames && window.frames[iframeId as any]
    }

    let ctx: AuthenticationContext = {
        config,
        login,
        logout,
        getUser,
        registerCallback,
        acquireToken,
        acquireTokenPopup,
        getRequestInfo,
        saveTokenFromHash,
        handleWindowCallback,
        _callBackMappedToRenewStates,
        _callBacksMappedToRenewStates,
    }
    return ((window as any)[SINGLETON] = ctx)
}

export let clearCacheForResource = (resource: string) => {
    saveItem(StorageKey.STATE_RENEW, "")
    saveItem(StorageKey.ERROR, "")
    saveItem(StorageKey.ERROR_DESCRIPTION, "")

    if (hasResource(resource)) {
        saveItem(StorageKey.ACCESS_TOKEN_KEY + resource, "")
        saveItem(StorageKey.EXPIRATION_KEY + resource, 0)
    }
}

let decodeJWT = (
    jwt: string,
):
    | {
          header: string
          JWSPayload: string
          JWSSig: string
      }
    | undefined => {
    if (isEmpty(jwt)) return

    let idTokenPartsRegex = /^([^\.\s]*)\.([^\.\s]+)\.([^\.\s]*)$/
    let matches = idTokenPartsRegex.exec(jwt)
    if (!matches || matches.length < 4) {
        if (process.env.NODE_ENV === "development") {
            Logger.warn("The returned id_token is not parseable.")
        }
        return
    }

    return {
        header: matches[1],
        JWSPayload: matches[2],
        JWSSig: matches[3],
    }
}

let readConfig = (config: Config): Config => {
    config = {
        popUp: false,
        instance: "https://login.microsoftonline.com/",
        loginResource: config.clientId,
        laodFrameTimeout: 6000,
        expireOffsetSeconds: 300,
        navigateToLoginRequestUrl: true,
        tenant: "common",
        callback: () => {},
        ...config,
    }
    if (!config.redirectUri) {
        config.redirectUri = window.location.href.split("?")[0].split("#")[0]
    }
    if (process.env.NODE_ENV === "development") {
        Logger.correlationId = config.correlationId
    }
    return config
}

/**
 * Alias for encodeURIComponent for smaller bundle sizes since encodeURIComponent
 * cannot be mangled as it refers to a global.
 */
let encode = (str: string) => encodeURIComponent(str)

/**
 * Checks if the authorization endpoint URL contains query string parameters
 */
let urlContainsQueryStringParameter = (name: string, url: string) =>
    new RegExp("[\\?&]" + name + "=").test(url)

/**
 * Removes the query string parameter from the authorization endpoint URL if it exists
 * we remove &name=value, name=value& and name=value
 */
let removeQueryStringParameter = (url: string, name: string) =>
    url
        .replace(new RegExp("(\\&" + name + "=)[^&]+"), "")
        .replace(new RegExp("(" + name + "=)[^&]+&"), "")
        .replace(new RegExp("(" + name + "=)[^&]+"), "")

/**
 * Saves a key-value pair in cache
 */
let saveItem = (key: string, value: any, preserve = false) => {
    if (preserve) {
        let old = getItem(key) || ""
        Storage.setItem(key, old + value + CACHE_DELIMETER)
    } else {
        Storage.setItem(key, value)
    }
}

/**
 * Checks for the resource in cache. By default, cache location is Session Storage
 */
let hasResource = (key: string): boolean => {
    let keys = getItem(StorageKey.TOKEN_KEYS)
    return !isEmpty(keys) && keys.indexOf(key + RESOURCE_DELIMETER) > -1
}

/**
 * Returns the anchor part (#) of the URL
 * TODO: can just use URL API?
 */
let getHash = (hash: string) => {
    if (hash.indexOf("#/") > -1) {
        return hash.substring(hash.indexOf("#/") + 2)
    } else if (hash.indexOf("#") > -1) {
        return hash.substring(1)
    } else {
        return hash
    }
}

/**
 * Checks if the URL fragment contains access token, id token or error_description.
 */
let isCallback = (hash: string): boolean => {
    let parameters = deserialize(getHash(hash))
    return (
        has(parameters, ERROR_DESCRIPTION) ||
        has(parameters, ACCESS_TOKEN) ||
        has(parameters, ID_TOKEN)
    )
}

/**
 * Parses the query string parameters into a key-value pair object.
 * @ignore
 */
let deserialize = (query: string) => {
    let pl = /\+/g, // Regex for replacing addition symbol with a space
        search = /([^&=]+)=([^&]*)/g,
        decode = (s: string) => decodeURIComponent(s.replace(pl, " ")),
        obj: any = {}

    let match = search.exec(query)
    while (match) {
        obj[decode(match[1])] = decode(match[2])
        match = search.exec(query)
    }
    return obj
}

/**
 * Matches nonce from the request with the response.
 */
let matchNonce = (user: any): boolean => {
    let requestNonce = getItem(StorageKey.NONCE_IDTOKEN)
    if (requestNonce) {
        for (let nonce of requestNonce.split(CACHE_DELIMETER)) {
            if (nonce === user.profile.nonce) {
                return true
            }
        }
    }
    return false
}

let getResourceFromState = (state: string): string => {
    if (state) {
        let splitIndex = state.indexOf(RESOURCE_DELIMETER)
        if (splitIndex > -1 && splitIndex + 1 < state.length) {
            return state.substring(splitIndex + 1)
        }
    }
    return ""
}

/**
 * Calculates the expires in value in milliseconds for the acquired token
 */
let expiresIn = (expires: any) => {
    // if AAD did not send "expires_in" property, use default expiration of 3599 seconds, for some reason AAD sends 3599 as "expires_in" value instead of 3600
    if (!expires) expires = 3599
    return now() + parseInt(expires, 10)
}

/**
 * Serializes the parameters for the authorization endpoint URL and returns the serialized uri string.
 */
let serialize = (responseType: string, obj: any, resource?: string): string => {
    if (!obj) return ""

    let str: string[] = [
        "?response_type=" + responseType,
        "client_id=" + encode(obj.clientId),
    ]
    if (resource) {
        str.push("resource=" + encode(resource))
    }

    str.push("redirect_uri=" + encode(obj.redirectUri))
    str.push("state=" + encode(obj.state))

    if (has(obj, "slice")) {
        str.push("slice=" + encode(obj.slice))
    }

    if (has(obj, "extraQueryParameter")) {
        str.push(obj.extraQueryParameter)
    }

    let correlationId = obj.correlationId || guid()
    str.push("client-request-id=" + encode(correlationId))

    return str.join("&")
}

/**
 * Generates RFC4122 version 4 guid (128 bits)
 */
let guid = () => {
    // RFC4122: The version 4 UUID is meant for generating UUIDs from truly-random or
    // pseudo-random numbers.
    // The algorithm is as follows:
    //     Set the two most significant bits (bits 6 and 7) of the
    //        clock_seq_hi_and_reserved to zero and one, respectively.
    //     Set the four most significant bits (bits 12 through 15) of the
    //        time_hi_and_version field to the 4-bit version number from
    //        Section 4.1.3. Version4
    //     Set all the other bits to randomly (or pseudo-randomly) chosen
    //     values.
    // UUID                   = time-low "-" time-mid "-"time-high-and-version "-"clock-seq-reserved and low(2hexOctet)"-" node
    // time-low               = 4hexOctet
    // time-mid               = 2hexOctet
    // time-high-and-version  = 2hexOctet
    // clock-seq-and-reserved = hexOctet:
    // clock-seq-low          = hexOctet
    // node                   = 6hexOctet
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // y could be 1000, 1001, 1010, 1011 since most significant two bits needs to be 10
    // y values are 8, 9, A, B
    let buffer = new Uint8Array(16)
    crypto.getRandomValues(buffer)
    //buffer[6] and buffer[7] represents the time_hi_and_version field. We will set the four most significant bits (4 through 7) of buffer[6] to represent decimal number 4 (UUID version number).
    buffer[6] |= 0x40 //buffer[6] | 01000000 will set the 6 bit to 1.
    buffer[6] &= 0x4f //buffer[6] & 01001111 will set the 4, 5, and 7 bit to 0 such that bits 4-7 == 0100 = "4".
    //buffer[8] represents the clock_seq_hi_and_reserved field. We will set the two most significant bits (6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively.
    buffer[8] |= 0x80 //buffer[8] | 10000000 will set the 7 bit to 1.
    buffer[8] &= 0xbf //buffer[8] & 10111111 will set the 6 bit to 0.
    buffer = buffer.map((n) => {
        let hex = n.toString(16)
        while (hex.length < 2) {
            hex = "0" + hex
        }
        return hex as any
    })

    return (
        buffer[0] +
        buffer[1] +
        buffer[2] +
        buffer[3] +
        "-" +
        buffer[4] +
        buffer[5] +
        "-" +
        buffer[6] +
        buffer[7] +
        "-" +
        buffer[8] +
        buffer[9] +
        "-" +
        buffer[10] +
        buffer[11] +
        buffer[12] +
        buffer[13] +
        buffer[14] +
        buffer[15]
    )
}

// let haveSameHost = (a: string, b: string) => new URL(a).host === new URL(b).host

let getItem = (key: string) => Storage.getItem(key)

let isEmpty = (str: string) => !str || !str.length

let has = (obj: any, key: string) => Object.hasOwnProperty.call(obj, key)

let now = () => Math.round(Date.now() / 1000)

enum StorageKey {
    TOKEN_KEYS = "adal.token.keys",
    ACCESS_TOKEN_KEY = "adal.access.token.key",
    EXPIRATION_KEY = "adal.expiration.key",
    STATE_LOGIN = "adal.state.login",
    STATE_RENEW = "adal.state.renew",
    NONCE_IDTOKEN = "adal.nonce.idtoken",
    SESSION_STATE = "adal.session.state",
    USERNAME = "adal.username",
    IDTOKEN = "adal.idtoken",
    ERROR = "adal.error",
    ERROR_DESCRIPTION = "adal.error.description",
    LOGIN_REQUEST = "adal.login.request",
    LOGIN_ERROR = "adal.login.error",
    RENEW_STATUS = "adal.token.renew.status",
}

interface IStorage {
    getItem(key: string): any
    setItem(key: string, value: any, preserve?: boolean): void
}

let Storage: IStorage = (() => {
    let supportsStorage = (type: string) => {
        let storage = (window as any)[type]
        if (!storage) {
            return false
        }
        let testKey = "__test__"
        storage.setItem(testKey, testKey)
        if (storage.getItem(testKey) !== testKey) {
            return false
        }
        storage.removeItem(testKey)
        if (storage.getItem(testKey)) {
            return false
        }
        return true
    }

    if (supportsStorage("localStorage")) return localStorage
    if (supportsStorage("sessionStorage")) return sessionStorage
    return {getItem() {}, setItem() {}} as IStorage
})()

export enum LogLevel {
    Error = 0,
    Warn,
    Info,
    Verbose,
}

let LOG_LEVEL_LABELS = {
    [LogLevel.Error]: "ERROR",
    [LogLevel.Warn]: "WARNING",
    [LogLevel.Info]: "INFO",
    [LogLevel.Verbose]: "VERBOSE",
}

let Logger = {
    pii: false,
    correlationId: undefined,
    level: LogLevel.Error,

    /**
     * Checks the Logging Level, constructs the Log message and logs it. Users need to implement/override this method to turn on Logging.
     * @param {number} level  -  Level can be set 0,1,2 and 3 which turns on 'error', 'warning', 'info' or 'verbose' level logging respectively.
     * @param {string} message  -  Message to log.
     * @param {string} error  -  Error to log.
     */
    log(
        level: LogLevel,
        message: string,
        error: Error | string | undefined | null,
        containsPii = false,
    ) {
        if (containsPii && !this.pii) return

        if (level <= this.level) {
            let timestamp = new Date().toUTCString()
            let formattedMessage =
                timestamp +
                ":" +
                (this.correlationId ? this.correlationId + "-" : "") +
                LOG_LEVEL_LABELS[level] +
                ": " +
                message

            if (error) {
                // @ts-expect-error
                formattedMessage += "\nstack:\n" + error.stack
            }

            console.log(formattedMessage)
        }
    },

    /**
     * Logs messages when Logging Level is set to 0.
     * @param {string} message  -  Message to log.
     * @param {string} error  -  Error to log.
     */
    error(message: string, error?: Error) {
        this.log(LogLevel.Error, message, error)
    },

    /**
     * Logs messages when Logging Level is set to 1.
     * @param {string} message  -  Message to log.
     */
    warn(message: string) {
        this.log(LogLevel.Warn, message, null)
    },

    /**
     * Logs messages when Logging Level is set to 2.
     * @param {string} message  -  Message to log.
     */
    info(message: string) {
        this.log(LogLevel.Info, message, null)
    },

    /**
     * Logs messages when Logging Level is set to 3.
     * @param {string} message  -  Message to log.
     */
    verbose(message: string) {
        this.log(LogLevel.Verbose, message, null)
    },

    /**
     * Logs Pii messages when Logging Level is set to 0 and window.piiLoggingEnabled is set to true.
     * @param {string} message  -  Message to log.
     * @param {string} error  -  Error to log.
     */
    errorPii(message: string, error: string) {
        this.log(LogLevel.Error, message, error, true)
    },

    /**
     * Logs  Pii messages when Logging Level is set to 1 and window.piiLoggingEnabled is set to true.
     * @param {string} message  -  Message to log.
     */
    warnPii(message: string) {
        this.log(LogLevel.Warn, message, null, true)
    },

    /**
     * Logs messages when Logging Level is set to 2 and window.piiLoggingEnabled is set to true.
     * @param {string} message  -  Message to log.
     */
    infoPii(message: string) {
        this.log(LogLevel.Info, message, null, true)
    },

    /**
     * Logs messages when Logging Level is set to 3 and window.piiLoggingEnabled is set to true.
     * @param {string} message  -  Message to log.
     */
    verbosePii(message: string) {
        this.log(LogLevel.Verbose, message, null, true)
    },
}
