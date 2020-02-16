package ru.neyvan.hm.actors;

/**
 * Created by AndyGo on 13.06.2018.
 */

public class CircleBurnActor {
    /*private ShaderProgram circle;
    private ShaderProgram batchShader;
    private Texture pixel;
    private float open;
    private Color color;
    public CircleBurnActor(Color color){
        this.color = color;
        pixel = new Texture("shaders/pixel.jpg");
        circle = HM.game.shader.getCircle();
        setColor(color);
        setOpen(0.0f);
    }


    protected void sizeChanged() {
        circle.begin();
        circle.setUniformf("u_center", Gdx.graphics.getWidth()/2, Gdx.graphics.getHeight()/2);
        circle.setUniformf("u_radius", getWidth() * 0.36f);
        circle.setUniformf("u_width", getWidth() * 0.1f);
        circle.end();
    }

    @Override
    protected void positionChanged() {
        circle.begin();
        circle.setUniformf("u_center", Gdx.graphics.getWidth()/2, Gdx.graphics.getHeight()/2);
        circle.end();
    }
//    public void reloadCenterPosition(){
//        Gdx.app.debug("circle shader actor", "reload center position");
//        Gdx.app.debug("circle shader actor", "origin x: "+getOriginX());
//        Gdx.app.debug("circle shader actor", "origin y: "+getOriginY());
//        Gdx.app.debug("circle shader actor", "width: "+getWidth());
//        Gdx.app.debug("circle shader actor", "height: "+getHeight());
//        positionShaderChange(getX(), getY());
//    }

    @Override
    public void draw(Batch batch, float parentAlpha) {
        batchShader = batch.getShader();
        batch.setShader(circle);
        batch.draw(pixel, getX(), getY(), getWidth(), getHeight());
        batch.setShader(batchShader);
    }

    public void setOpen(float open) {
        this.open = open;
        circle.begin();
        circle.setUniformf("u_opening", open);
        circle.end();
    }
    public void setColor(Color color) {
        this.color = color;
        circle.begin();
        circle.setUniformf("u_color", color.r, color.g, color.b);
        circle.end();
    }*/
}
