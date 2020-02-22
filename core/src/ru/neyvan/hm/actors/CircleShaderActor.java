package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Widget;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 28.03.2018.
 */

public class CircleShaderActor extends Actor {
    private ShaderProgram circle;
    private ShaderProgram batchShader;
    private Texture pixel;
    private float open;
    private Color defaultColor;


    public CircleShaderActor(Color defaultColor){
        this.defaultColor = defaultColor;
        pixel = new Texture("shaders/pixel.jpg");
        circle = HM.game.shader.getCircle();
        setOpen(0.0f);
        setColor();
    }

    @Override
    protected void sizeChanged() {
        circle.begin();
        circle.setUniformf("u_center", getWidth()/2, getHeight()/2);
        circle.setUniformf("u_radius", 0.8f*getWidth());
        circle.setUniformf("u_width", getWidth() * 0.1f);
        circle.end();
    }

    @Override
    protected void positionChanged() {
        circle.begin();
        circle.setUniformf("u_center", getWidth()/2, getHeight()/2);
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
        batch.setColor(getColor());
        batch.setShader(circle);
        batch.draw(pixel, 0, 0, getWidth(), getHeight());
        batch.setShader(batchShader);
    }

    public void setOpen(float open) {
        this.open = open;
        circle.begin();
        circle.setUniformf("u_opening", open);
        circle.end();
    }
    public void setColor() {
        circle.begin();
        circle.setUniformf("u_color", defaultColor.r, defaultColor.g, defaultColor.b);
        circle.end();
    }
    public void setColor(Color color) {
        circle.begin();
        circle.setUniformf("u_color", color.r, color.g, color.b);
        circle.end();
    }
}
