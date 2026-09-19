import UIKit
import ARKit
import RealityKit

final class HearthsideARController: UIViewController, ARSessionDelegate {
    let sessionId: String
    var scene: NativeScene
    var emit: (String, String?) -> Void = { _, _ in }
    private let arView = ARView(frame: .zero)
    private let object = ModelEntity()
    private var anchor: AnchorEntity?
    private var label = UILabel()
    private var coin = UIButton(type: .system)
    private var currentTracking = "searching"
    private var receiptGate: NativeReceiptGate
    private var observers: [NSObjectProtocol] = []
    private var reviewPending = false

    init(sessionId: String, scene: NativeScene) {
        self.sessionId = sessionId; self.scene = scene
        self.receiptGate = NativeReceiptGate(sessionId: sessionId, identity: scene.identity)
        super.init(nibName: nil, bundle: nil); modalPresentationStyle = .fullScreen
    }
    required init?(coder: NSCoder) { fatalError("Use the reviewed native scene initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .systemBackground
        arView.frame = view.bounds; arView.autoresizingMask = [.flexibleWidth, .flexibleHeight]; view.addSubview(arView)
        arView.session.delegate = self; arView.automaticallyConfigureSession = false
        do { try loadMeshes() } catch { emit("error", "invalid-model"); dismiss(animated: true); return }
        label.text = "Move slowly, then tap a surface to place your cat."; label.numberOfLines = 0; label.textColor = .label
        label.backgroundColor = .secondarySystemBackground; label.textAlignment = .center; label.accessibilityTraits = .updatesFrequently
        let close = button("Return to Hearth", #selector(closeScene)); coin = button("Review a contribution", #selector(requestFunding))
        let left = button("Rotate left", #selector(rotateLeft)), right = button("Rotate right", #selector(rotateRight))
        coin.isHidden = scene.fundingEnabled == false
        let controls = UIStackView(arrangedSubviews: [label, UIStackView(arrangedSubviews: [left, right]), coin, close])
        controls.axis = .vertical; controls.spacing = 8; controls.backgroundColor = .secondarySystemBackground
        controls.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(controls)
        NSLayoutConstraint.activate([controls.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12), controls.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12), controls.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12)])
        arView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tap(_:))))
        arView.addGestureRecognizer(UIRotationGestureRecognizer(target: self, action: #selector(twist(_:))))
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.pause() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in if self?.view.window != nil { self?.resume() } })
        updateBacking(); resume()
    }
    private func button(_ title: String, _ action: Selector) -> UIButton {
        let result = UIButton(type: .system); result.setTitle(title, for: .normal); result.accessibilityLabel = title
        result.titleLabel?.font = .preferredFont(forTextStyle: .headline); result.titleLabel?.adjustsFontForContentSizeCategory = true
        result.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true; result.addTarget(self, action: action, for: .touchUpInside); return result
    }
    private func loadMeshes() throws {
        for mesh in scene.meshes {
            var descriptor = MeshDescriptor(name: mesh.name)
            descriptor.positions = MeshBuffers.Positions(stride(from: 0, to: mesh.positions.count, by: 3).map { SIMD3(mesh.positions[$0], mesh.positions[$0 + 1], mesh.positions[$0 + 2]) })
            descriptor.normals = MeshBuffers.Normals(stride(from: 0, to: mesh.normals.count, by: 3).map { SIMD3(mesh.normals[$0], mesh.normals[$0 + 1], mesh.normals[$0 + 2]) })
            descriptor.textureCoordinates = MeshBuffers.TextureCoordinates(stride(from: 0, to: mesh.uvs.count, by: 2).map { SIMD2(mesh.uvs[$0], mesh.uvs[$0 + 1]) })
            descriptor.primitives = .triangles(mesh.indices)
            let resource = try MeshResource.generate(from: [descriptor])
            var material = PhysicallyBasedMaterial()
            let tint = UIColor(red: CGFloat(mesh.color[0]), green: CGFloat(mesh.color[1]), blue: CGFloat(mesh.color[2]), alpha: CGFloat(mesh.color[3]))
            if !mesh.texturePng.isEmpty, let data = Data(base64Encoded: mesh.texturePng), let image = UIImage(data: data)?.cgImage {
                let texture = try TextureResource.generate(from: image, options: .init(semantic: .color))
                material.baseColor = .init(tint: tint, texture: .init(texture))
            } else { material.baseColor = .init(tint: tint) }
            material.roughness = .init(floatLiteral: 0.42)
            let entity = ModelEntity(mesh: resource, materials: [material]); entity.name = mesh.name; object.addChild(entity)
        }
        object.generateCollisionShapes(recursive: true)
    }
    func resume() {
        guard ARWorldTrackingConfiguration.isSupported, !reviewPending else { return }
        let config = ARWorldTrackingConfiguration(); config.planeDetection = [.horizontal, .vertical]
        arView.session.run(config); emit("resumed", nil)
    }
    func pause() { arView.session.pause(); emit("background", nil) }
    func returnFromReview() { reviewPending = false; coin.isEnabled = true; resume() }
    func stop() {
        arView.session.pause(); arView.session.delegate = nil
        arView.scene.anchors.removeAll(); anchor = nil
        for child in Array(object.children) { child.removeFromParent() }
        observers.forEach(NotificationCenter.default.removeObserver); observers.removeAll()
    }
    @objc private func tap(_ recognizer: UITapGestureRecognizer) {
        guard currentTracking == "tracking", !reviewPending else { return }
        let point = recognizer.location(in: arView)
        if arView.entity(at: point) != nil && anchor != nil { UIImpactFeedbackGenerator(style: .soft).impactOccurred(); object.orientation *= simd_quatf(angle: 0.16, axis: [0, 1, 0]); return }
        guard let hit = arView.raycast(from: point, allowing: .existingPlaneGeometry, alignment: .any).first else { label.text = "A little more room: point at a clear surface."; return }
        if let old = anchor { arView.scene.removeAnchor(old) }
        let placed = AnchorEntity(world: hit.worldTransform); placed.addChild(object); arView.scene.addAnchor(placed); anchor = placed
        label.text = scene.fundingEnabled == false ? "Your cat is here. Turn it and enjoy your piece." : "Your cat is here. Turn it, tap it, or review a contribution."
    }
    @objc private func twist(_ gesture: UIRotationGestureRecognizer) { guard !reviewPending else { return }; object.orientation *= simd_quatf(angle: -Float(gesture.rotation), axis: [0, 1, 0]); gesture.rotation = 0 }
    @objc private func rotateLeft() { object.orientation *= simd_quatf(angle: -0.26, axis: [0, 1, 0]) }
    @objc private func rotateRight() { object.orientation *= simd_quatf(angle: 0.26, axis: [0, 1, 0]) }
    @objc private func requestFunding() {
        guard !reviewPending, scene.fundingEnabled != false else { return }; reviewPending = true; coin.isEnabled = false; arView.session.pause()
        dismiss(animated: true) { self.emit("funding-intent", nil) }
    }
    @objc private func closeScene() { stop(); dismiss(animated: true) { self.emit("closed", nil) } }
    private func updateBacking() { object.scale = SIMD3(repeating: scene.backing.scale); coin.isEnabled = !reviewPending }
    func accepted(identity: NativeIdentity, receiptId: String, backing: NativeBacking, animate: Bool) throws {
        try backing.validate()
        guard try receiptGate.accept(sessionId: sessionId, identity: identity, receiptId: receiptId) else { return }
        scene.backing = backing; reviewPending = false; updateBacking()
        if animate && !UIAccessibility.isReduceMotionEnabled { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }
    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        let state: String
        switch camera.trackingState { case .normal: state = "tracking"; case .notAvailable: state = "unavailable"; case .limited: state = "searching" }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.currentTracking != state else { return }; self.currentTracking = state
            self.label.text = state == "tracking" ? (self.anchor == nil ? "Tap a surface to place your cat." : "Your cat is here.") : "Move slowly while the camera finds the surface again."
            self.emit("tracking", state)
        }
    }
    func session(_ session: ARSession, didFailWithError error: Error) { DispatchQueue.main.async { self.label.text = "The camera could not continue. Return to Hearth and try again."; self.emit("error", "tracking-failed") } }
    func sessionWasInterrupted(_ session: ARSession) { emit("tracking", "interrupted") }
    func sessionInterruptionEnded(_ session: ARSession) { resume() }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }
}
