import "./main.css"

let main = () => {
    let node = document.createElement("h1")
    node.className = "hello-world"
    node.textContent = "Hello world"
    document.body.append(node)
}

main()
