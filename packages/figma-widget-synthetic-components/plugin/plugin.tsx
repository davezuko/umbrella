const {widget} = figma
const {AutoLayout, Text} = widget

const Widget = () => {
    return (
        <AutoLayout
            direction="horizontal"
            horizontalAlignItems="center"
            verticalAlignItems="center"
            height="hug-contents"
            padding={8}
            fill="#FFFFFF"
            cornerRadius={8}
            spacing={12}
            onClick={async () => {
                await new Promise((_resolve) => {
                    figma.showUI(__html__)
                    figma.ui.on("message", (msg) => {
                        if (msg === "hello") {
                            figma.notify(`Hello Widgets`)
                        }
                        if (msg === "close") {
                            figma.closePlugin()
                        }
                    })
                })
            }}
        >
            <Text fontSize={32} horizontalAlignText="center">
                Click Me
            </Text>
        </AutoLayout>
    )
}

widget.register(Widget)
