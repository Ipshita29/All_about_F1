import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, ContactShadows } from "@react-three/drei";

function CarModel({ url }) {
    const { scene } = useGLTF(url);
    return <primitive object={scene} scale={1} position={[0, -0.5, 0]} />;
}

export default function Ferrari3D({ modelUrl = "/models/Ferrari_SF25_Leclerc.glb" }) {
    return (
        <div className="ferrari-3d-wrapper">
            <Canvas
                camera={{ position: [3, 1, 2.5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "#ffffff"}}
                onCreated={({ camera }) => {
                    camera.lookAt(0, -0.2, 0);
                    camera.updateProjectionMatrix();
                }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 6, 4]} intensity={2} color="#ffffff" castShadow />
                <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#ffaaaa" />
                <pointLight position={[0, 4, 4]} intensity={1.2} color="#E10600" />

                <Suspense fallback={null}>
                    <CarModel url={modelUrl} />
                    <ContactShadows
                        position={[0, -0.5, 0]}
                        opacity={0.55}
                        scale={20}
                        blur={2.5}
                        far={4}
                    />
                    <Environment preset="city" />
                </Suspense>

                <OrbitControls
                    makeDefault
                    enableZoom
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={1.5}
                    target={[0, -0.2, 0]}
                    minPolarAngle={Math.PI / 8}
                    maxPolarAngle={Math.PI / 2.1}
                    minDistance={1}
                    maxDistance={15}
                />
            </Canvas>
        </div>
    );
}
